"use server";

import db from "@/drizzle/db";
import {
  MentorshipBookingTable,
  MentorshipChatFilesTable,
  MentorshipChatTable,
  MentorshipProfileTable,
  MentorshipSessionTable,
  PaymentPorposeEnumType,
  PaymentTable,
  UserTable,
} from "@/drizzle/schemas";
import { env } from "@/env/server";
import {
  getServerUserSession,
  isAuthorized,
} from "@/features/auth/server/actions";
import { UploadedFileMeta } from "@/features/media/media-types";
import {
  AvailabilitySlot,
  BookingFormData,
  bookingSchema,
  MentorListigWithAvailbelDates,
  stripeTaskCheckoutParamsConf,
} from "@/features/mentore/server/types";
import { Notifier } from "@/features/notifications/server/notifier";
import { getServerReturnUrl } from "@/features/subscriptions/server/action";
import {
  createStripeCustomer,
  getServerUserSubscriptionById,
} from "@/features/users/server/actions";
import { publicUserColumns } from "@/features/users/server/user-types";
import { withCache } from "@/lib/cache";
import {
  MentorError,
  SessionNotFoundError,
  SubscriptionError,
} from "@/lib/Errors";
import { logger } from "@/lib/logging/winston";
import { stripe } from "@/lib/stripe";
import { to } from "@/lib/utils/async";
import {
  calculateSlotDuration,
  daysInWeek,
  sessionTimeUtils,
} from "@/lib/utils/utils";
import { addDays, format, isFuture, startOfWeek } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { and, count, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function validateMentorAccess() {
  const user = (await getServerUserSession())!;
  if (!user || !user.id) {
    throw new Error("Unauthorized");
  }

  const usrSub = await getServerUserSubscriptionById(user.id);
  if (!usrSub || !usrSub.tier) {
    throw new Error("Unauthorized");
  }

  if (user.role !== "SOLVER") {
    throw new SubscriptionError();
  }

  if (usrSub.tier !== "SOLVER++") {
    throw new MentorError();
  }

  return { user, usrSub };
}

export async function getMentorListigProfile() {
  const { user, usrSub } = await validateMentorAccess();
  const result = await db.query.MentorshipProfileTable.findFirst({
    where: (tb, fn) => fn.eq(tb.userId, user.id!),
  });
  return {
    ...result!,
    displayName: result?.displayName || user.name!,
    description: result?.description ?? "",
    title: result?.title ?? "",
    avatar: result?.avatar ?? "",
    ratePerHour: result?.ratePerHour ?? 0,
    availableTimes: result?.availableTimes ?? [],
  };
}

export async function handleProfilePublishState(isPublished: boolean) {
  const { user, usrSub } = await validateMentorAccess();
  await db
    .insert(MentorshipProfileTable)
    .values({
      userId: user.id!,
      isPublished,
    })
    .onConflictDoUpdate({
      target: MentorshipProfileTable.userId,
      set: { isPublished },
    });
}
export async function handleProfileAvatarState(avatar: string) {
  const { user, usrSub } = await validateMentorAccess();
  await db
    .insert(MentorshipProfileTable)
    .values({
      userId: user.id!,
      avatar,
    })
    .onConflictDoUpdate({
      target: MentorshipProfileTable.userId,
      set: { avatar },
    });
}
export async function saveMentorListing(values: {
  displayName: string;
  title: string;
  avatar: string;
  description: string;
  availableTimes: AvailabilitySlot[];
  ratePerHour: number;
}) {
  const {
    displayName,
    title,
    description,
    availableTimes,
    ratePerHour,
    avatar,
  } = values;
  try {
    const { user, usrSub } = await validateMentorAccess();

    await db
      .insert(MentorshipProfileTable)
      .values({
        userId: user.id!,
        title,
        displayName,
        description,
        avatar,
        availableTimes: availableTimes,
        ratePerHour,
      })
      .onConflictDoUpdate({
        target: MentorshipProfileTable.userId!,
        set: {
          displayName,
          title,
          description,
          availableTimes: availableTimes,
          ratePerHour,
        },
      });
    logger.info("successfully saved mentor profile ");
  } catch (error) {
    logger.error("unable to save mentor listing", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

function toYMD(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const getSessionKey = (dateYMD: string, slot: AvailabilitySlot) =>
  `${dateYMD}-${slot.day}-${slot.start}-${slot.end}`;

export async function getMentorAllSessionCount(solverId: string) {
  const allsessions = await db
    .select({ count: count(MentorshipSessionTable.id) })
    .from(MentorshipSessionTable)
    .leftJoin(
      MentorshipBookingTable,
      eq(MentorshipBookingTable.id, MentorshipSessionTable.bookingId),
    )
    .where(eq(MentorshipBookingTable.solverId, solverId));
  return allsessions[0];
}
export async function getMentorListigWithAvailbelDates() {
  const allMentors = await db.query.MentorshipProfileTable.findMany();

  const allBookedSessions = await db.query.MentorshipSessionTable.findMany({
    with: {
      bookedSessions: true,
    },
  });
  const bookedKeys = new Set(
    allBookedSessions.map((session) => {
      const solverId = session.bookedSessions.solverId;
      return `${solverId}-${getSessionKey(
        session.sessionDate,
        session.timeSlot,
      )}`;
    }),
  );

  const mentorsWithFilteredAvailability = allMentors.map((mentor) => {
    const availableTimes = mentor.availableTimes as AvailabilitySlot[];
    const availableDates: { date: Date; slot: AvailabilitySlot }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });

    for (const slot of availableTimes) {
      const dayIndex = daysInWeek.indexOf(slot.day.toLowerCase());
      if (dayIndex === -1) continue;

      for (let week = 0; week < 12; week++) {
        const dateObj = addDays(weekStart, week * 7 + dayIndex);
        if (!isFuture(dateObj)) continue;

        const ymd = toYMD(dateObj);
        const key = `${mentor.userId}-${getSessionKey(ymd, slot)}`;

        if (!bookedKeys.has(key)) {
          availableDates.push({ date: dateObj, slot });
        }
      }
    }

    return { ...mentor, availableDates };
  });

  return mentorsWithFilteredAvailability;
}
export async function getMentorListigWithAvailbelDatesV2() {
  const [allMentors, allBookedSessions] = await Promise.all([
    db.query.MentorshipProfileTable.findMany(),
    db.query.MentorshipSessionTable.findMany({
      with: {
        bookedSessions: true,
      },
    }),
  ]);

  const bookedKeys = new Set(
    allBookedSessions.map((session) => {
      const solverId = session.bookedSessions.solverId;
      return `${solverId}-${getSessionKey(
        session.sessionDate,
        session.timeSlot,
      )}`;
    }),
  );

  const mentorsWithFilteredAvailability = allMentors.map((mentor) => {
    const availableTimes = mentor.availableTimes;
    const availableDates: {
      date: Date;
      slot: AvailabilitySlot;
      sessionStart: string;
      sessionEnd: string;
      mentorTimezone: string;
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });

    for (const slot of availableTimes) {
      const dayIndex = daysInWeek.indexOf(slot.day.toLowerCase());
      if (dayIndex === -1) continue;

      for (let week = 0; week < 12; week++) {
        const dateObj = addDays(weekStart, week * 7 + dayIndex);
        if (!isFuture(dateObj)) continue;

        const ymd = toYMD(dateObj);
        const key = `${mentor.userId}-${getSessionKey(ymd, slot)}`;

        if (!bookedKeys.has(key)) {
          const mentorTz = mentor.timezone || "Asia/Kuala_Lumpur";

          const sessionStart = fromZonedTime(
            `${toYMD(dateObj)}T${slot.start}`,
            mentorTz,
          ).toISOString();

          const sessionEnd = fromZonedTime(
            `${toYMD(dateObj)}T${slot.end}`,
            mentorTz,
          ).toISOString();

          availableDates.push({
            date: dateObj,
            slot,
            sessionStart,
            sessionEnd,
            mentorTimezone: mentorTz,
          });
        }
      }
    }

    return { ...mentor, availableDates };
  });

  return mentorsWithFilteredAvailability;
}
export async function cleanPendingBookign(booking_id: string) {
  try {
    await db
      .delete(MentorshipBookingTable)
      .where(
        and(
          eq(MentorshipBookingTable.id, booking_id),
          eq(MentorshipBookingTable.status, "PENDING"),
        ),
      );
  } catch (error) {}
}
export async function createMentorBookingPaymentCheckout(values: {
  data: BookingFormData;
  mentor: MentorListigWithAvailbelDates;
}) {
  const referer = await getServerReturnUrl();
  try {
    const { data, mentor } = values;
    const { user } = await isAuthorized(["POSTER"]);
    const userId = user.id;

    const validData = bookingSchema.safeParse(data);
    if (!validData.success) throw new Error("all fields are requred");
    if (validData.data.sessions.length === 0) return;

    const totalPrice = validData.data.sessions.reduce((sum, session) => {
      const duration = calculateSlotDuration(session.slot);
      return sum + mentor.ratePerHour * duration;
    }, 0);

    let customerId = user.stripeCustomerId;

    if (!user.stripeCustomerId) {
      const [newCustomerId, error] = await createStripeCustomer(user);
      if (error) {
        throw new Error("internal Server Error");
      }
      customerId = newCustomerId;
    }

    const [newBookingId, error] = await createPendingMentorshipBooking({
      data,
      posterId: userId,
      solverId: mentor.userId,
      totalPrice,
    });
    if (error) {
      throw new Error("internal Server Error");
    }
    const bookingId = newBookingId;
    logger.warn("before creating checkout sessoin bookingId: " + bookingId);

    const session = await stripe.checkout.sessions.create({
      ...stripeTaskCheckoutParamsConf({
        bookingId,
        customerId: customerId!,
        referer,
        totalPrice,
        userId,
      }),
    });

    if (!session.url) throw new Error("Failed to create checkout session");
    redirect(session.url);
  } catch (error) {
    throw error;
  }
}

export async function updateMentorBooking(
  bookingId: string,
  totalAmount: number,
  userId: string,
  stripeChargeId: string,
  stripePaymentIntentId: string,
) {
  try {
    const res = await db.query.MentorshipBookingTable.findFirst({
      where: (tb, fn) => fn.eq(tb.id, bookingId),
      with: {
        solver: {
          columns: { displayName: true },
          with: { mentorSystemDetail: { columns: { email: true } } },
        },
        bookedSessions: true,
      },
    });
    if (!res) {
      throw new Error("failed to update Mentor Temperory Booking");
    }

    const amountPerSession = totalAmount / res.bookedSessions.length;

    for (const session of res.bookedSessions) {
      const [payment] = await db
        .insert(PaymentTable)
        .values({
          amount: amountPerSession,
          userId,
          purpose: "Mentor Booking",
          status: "HOLD",
          stripeChargeId,
          stripePaymentIntentId,
        })
        .returning({ paymentId: PaymentTable.id });
      await db
        .update(MentorshipSessionTable)
        .set({ paymentId: payment.paymentId })
        .where(eq(MentorshipSessionTable.id, session.id));
    }
    await db
      .update(MentorshipBookingTable)
      .set({
        status: "PAID",
      })
      .where(eq(MentorshipBookingTable.id, bookingId));

    if (res.status === "PAID") {
      logger.info("Succesfully updated Temperory Mentor Booking");
    }

    Notifier()
      .system({
        receiverId: res.solverId,
        subject: "Mentorship Booking",
        content: "A Student booked a session! please check the session page",
      })
      .email({
        receiverEmail: res.solver.mentorSystemDetail.email!,
        subject: "Mentorship Booking",
        content: `<h3>A Student booked a session! please check the session page Or <a href="${env.NEXTAUTH_URL}/dashboard/solver/mentor" target="_blank">click here</a></h3>`,
      });
  } catch (error) {
    logger.error(
      "failed to update Mentor Temperory Booking\n" + (error as Error).message,
    );
    throw new Error("failed to update Mentor Temperory Booking");
  }
}

export async function getMentorBookingSessions() {
  const { user } = await isAuthorized(["POSTER", "SOLVER"]);

  const authorizedCondition =
    user.role === "POSTER"
      ? eq(MentorshipBookingTable.posterId, user.id)
      : eq(MentorshipBookingTable.solverId, user.id);
  const where = and(
    authorizedCondition,
    eq(MentorshipBookingTable.status, "PAID"),
  );
  const result = await db.query.MentorshipBookingTable.findMany({
    where,
    with: {
      bookedSessions: true,
      solver: true,
      poster: { columns: publicUserColumns },
    },
    orderBy: (tb, fn) => fn.desc(tb.createdAt),
  });
  const totol =
    result.length > 0
      ? result
          .map((r) => {
            return r.bookedSessions.length;
          })
          .reduce((a, b) => a + b)
      : 0;

  return { result, totalCount: totol };
}
async function getMentorSessionQuery(sessionId: string) {
  const { user } = await isAuthorized(["POSTER", "SOLVER"]);
  const [result] = await db
    .select({
      session: MentorshipSessionTable,
      booking: MentorshipBookingTable,
      poster: {
        id: UserTable.id,
        email: UserTable.email,
        name: UserTable.name,
        image: UserTable.image,
        role: UserTable.role,
        emailVerified: UserTable.emailVerified,
      },
      solver: MentorshipProfileTable,
    })
    .from(MentorshipSessionTable)
    .innerJoin(
      MentorshipBookingTable,
      eq(MentorshipSessionTable.bookingId, MentorshipBookingTable.id),
    )
    .innerJoin(UserTable, eq(MentorshipBookingTable.posterId, UserTable.id))
    .innerJoin(
      MentorshipProfileTable,
      eq(MentorshipBookingTable.solverId, MentorshipProfileTable.userId),
    )
    .where(
      and(
        eq(MentorshipSessionTable.id, sessionId),
        user.role === "POSTER"
          ? eq(MentorshipBookingTable.posterId, user.id)
          : eq(MentorshipBookingTable.solverId, user.id),
      ),
    )
    .limit(1);
  return result;
}
export async function getMentorSession(sessionId: string) {
  if (!sessionId) return;

  const [row, err] = await to(getMentorSessionQuery(sessionId));

  if (err) {
    logger.error("unable to fetch the session info", {
      message: (err as Error).message,
      stack: (err as Error).stack,
    });
  }

  if (!row) {
    throw new SessionNotFoundError();
  }
  const [chats, chatErr] = await to(
    db.query.MentorshipChatTable.findMany({
      where: (tb, fn) => fn.eq(tb.sessionId, sessionId),
      with: {
        chatFiles: true,
        chatOwner: { columns: publicUserColumns },
      },
      orderBy: (tb, fn) => fn.asc(tb.createdAt),
    }),
  );
  if (chatErr) {
    logger.error("unable to fetch the session info", {
      message: (chatErr as Error).message,
      stack: (chatErr as Error).stack,
    });
    throw new SessionNotFoundError();
  }

  return {
    session: {
      ...row.session,
      bookedSessions: {
        ...row.booking,
        poster: row.poster,
        solver: row.solver,
      },
    },
    chats,
  };
}
async function getSessionById(sessionId: string) {
  try {
    const result = await db.query.MentorshipSessionTable.findFirst({
      where: (table, fn) => fn.eq(table.id, sessionId),
    });
    return result;
  } catch (error) {
    console.error(error);
    return null;
  }
}
type MentorMessageValues = {
  sessionId: string;
  sentBy: string;
  sentTo: string;
  message: string;
  uploadedFiles: UploadedFileMeta[];
  messageType?: "chat_message" | "chat_deleted";
};

export async function revalidateMentorSessinoData(values: {
  sessionId: string;
  role: string;
}) {
  const { role, sessionId } = values;
  revalidatePath(`${env.NEXTAUTH_URL}/dashboard/${role}/sessions/${sessionId}`);
}

export async function deleteFileFromChatSessionDb(
  fileId: string,
  userId: string,
) {
  try {
    const txResult = await db.transaction(async (dx) => {
      const [chatFile] = await dx
        .delete(MentorshipChatFilesTable)
        .where(
          and(
            eq(MentorshipChatFilesTable.id, fileId),
            eq(MentorshipChatFilesTable.uploadedById, userId),
          ),
        )
        .returning();
      const [updatedChat] = await dx
        .update(MentorshipChatTable)
        .set({ isDeleted: true })
        .where(
          and(
            eq(MentorshipChatTable.id, chatFile.chatId),
            eq(MentorshipChatTable.sentBy, userId),
          ),
        )
        .returning();
      return updatedChat;
    });

    revalidatePath(
      `${env.NEXTAUTH_URL}/dashboard/solver/sessions/${txResult.sessionId}`,
    );
    revalidatePath(
      `${env.NEXTAUTH_URL}/dashboard/poster/sessions/${txResult.sessionId}`,
    );
  } catch (error) {
    console.error(error);
    throw new Error("Something went Wrong", { cause: error });
  }
}

async function createPendingMentorshipBooking({
  data,
  posterId,
  solverId,
  totalPrice,
}: {
  totalPrice: number;
  data: BookingFormData;
  posterId: string;
  solverId: string;
}) {
  return await to(
    db.transaction(async (tx) => {
      const result = await tx
        .insert(MentorshipBookingTable)
        .values({
          posterId,
          solverId,
          price: totalPrice,
          notes: data.notes,
          status: "PENDING",
        })
        .returning({ bookingId: MentorshipBookingTable.id });
      const bookingId = result[0].bookingId;
      logger.warn("Temperory Saved Booking in Pending Status " + bookingId);

      await Promise.all(
        data.sessions.map((session) =>
          tx.insert(MentorshipSessionTable).values({
            bookingId: bookingId,
            sessionDate: format(session.date, "yyyy-MM-dd"),
            timeSlot: session.slot,
            sessionStart: new Date(session.sessionStart),
            sessionEnd: new Date(session.sessionEnd),
          }),
        ),
      );
      return bookingId;
    }),
  );
}
