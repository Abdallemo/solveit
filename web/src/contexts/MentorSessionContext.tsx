"use client";
import Loading from "@/app/dashboard/poster/(mentorship)/sessions/[sessionId]/loading";
import { env } from "@/env/client";
import MediaPreviewer from "@/features/media/components/MediaPreviewer";
import { UploadedFileMeta } from "@/features/media/media-types";
import { getMentorSession } from "@/features/mentore/server/action";
import {
  MentorChatSession,
  MentorSession,
} from "@/features/mentore/server/types";
import { useWebSocket } from "@/hooks/useWebSocketClass";
import { SessionNotFoundError } from "@/lib/Errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type PartialMentorSession = Partial<MentorSession>;
type MentorshipSessionContextType = {
  mentorshipSession: MentorSession;
  chats: MentorChatSession[];
  updateSession: (updates: PartialMentorSession) => void;
  setChats: Dispatch<SetStateAction<MentorChatSession[]>>;
  uploadingFiles: File[];
  setUploadingFiles: Dispatch<SetStateAction<File[]>>;
  sentTo: string | null;
  send: (
    msg: MentorChatSession & {
      messageType: "chat_message" | "chat_deleted";
      deleted_file_paths: string[];
      is_deleted: boolean;
    },
  ) => void;
  filePreview: UploadedFileMeta | null;
  setFilePreview: Dispatch<SetStateAction<UploadedFileMeta | null>>;
};

const MentorshipSessionContext = createContext<
  MentorshipSessionContextType | undefined
>(undefined);

type MentorshipSessionProviderProps = {
  children: ReactNode;
  sessionId: string;
  userId: string;
};

export const MentorshipSessionProvider = ({
  children,
  sessionId,
  userId,
}: MentorshipSessionProviderProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();
  const queryKey = [sessionId, userId];
  const {
    data: sessionData,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => await getMentorSession(sessionId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (error) throw new SessionNotFoundError();

  const [session, setSession] = useState<MentorSession | null>(null);
  const [chats, setChats] = useState<MentorChatSession[]>([]);

  useEffect(() => {
    if (!isLoading && sessionData?.session) {
      setSession(sessionData.session);
      setChats(sessionData.chats || []);
    }
  }, [isLoading, sessionData]);
  const sentTo = useMemo(() => {
    if (!session?.bookedSessions || !userId) return null;
    return userId === session.bookedSessions.posterId
      ? session.bookedSessions.solverId
      : session.bookedSessions.posterId;
  }, [userId, session?.bookedSessions]);

  const updateSession = useCallback((updates: PartialMentorSession) => {
    setSession((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const [filePreview, setFilePreview] = useState<UploadedFileMeta | null>(null);
  const allFiles = useMemo(() => {
    return chats.flatMap((chat) => chat.chatFiles);
  }, [chats]);

  const { send } = useWebSocket<
    MentorChatSession & {
      messageType: "chat_message" | "chat_deleted";
      deleted_file_paths: string[];
      is_deleted: boolean;
    }
  >(
    `${env.NEXT_PUBLIC_GO_API_WS_URL}/mentorship?session_id=${sessionId}:${userId}`,
    {
      onOpen: () => {
        queryClient.invalidateQueries({ queryKey });
      },
      onMessage: (msg) => {
        setChats((old) => {
          switch (msg.messageType) {
            case "chat_message":
              console.log(msg);

              if (old.some((c) => c.id === msg.id)) return old;
              return [
                ...old,
                { ...msg, createdAt: new Date(msg.createdAt!), readAt: null },
              ];
            case "chat_deleted":
              console.log(msg);

              return old.map((c) =>
                c.id === msg.id
                  ? {
                      ...c,
                      isDeleted: msg.is_deleted,
                      chatFiles: c.chatFiles.map((ch) => {
                        return msg.deleted_file_paths.includes(ch.filePath)
                          ? { ...ch, isDeleted: true }
                          : ch;
                      }),
                    }
                  : c,
              );
            default:
              return old;
          }
        });
      },
    },
  );
  const contextValue = useMemo(
    () => ({
      mentorshipSession: session!,
      chats,
      updateSession,
      setChats,
      uploadingFiles,
      setUploadingFiles,
      sentTo,
      send,
      filePreview,
      setFilePreview,
    }),
    [session, chats, updateSession, uploadingFiles, sentTo, send, filePreview],
  );

  if (isLoading || !session) return <Loading />;

  return (
    <MentorshipSessionContext.Provider value={contextValue}>
      {children}
      <MediaPreviewer
        fileRecords={allFiles}
        filePreview={filePreview}
        onClose={() => {
          setFilePreview(null);
        }}
        onDownload={() => {
          setFilePreview(null);
        }}
      />
    </MentorshipSessionContext.Provider>
  );
};

export const useMentorshipSession = () => {
  const context = useContext(MentorshipSessionContext);
  if (!context)
    throw new Error("useMentorship must be used within a MentorshipProvider");
  return context;
};
