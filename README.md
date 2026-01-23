
# SolveIt

**SaaS Platform for Academic Collaboration and Task Solving at UTHM**

SolveIt connects students in a secure and structured environment to **post, pick up, and complete academic tasks** while managing payments and preventing cheating. With **real-time updates, AI moderation, and an integrated workspace**, SolveIt ensures tasks are completed efficiently and safely.

**Key Features:**

* **Role-based system:** Posters, Solvers, Moderators, Admins
* **Secure payments:** Escrow system with Stripe integration
* **Real-time collaboration:** Messaging and notifications
* **AI moderation:** Automatic detection of cheating and inappropriate content
* **Structured workspace:** Organize and submit solutions seamlessly
<img width="2763" height="1645" alt="image" src="https://github.com/user-attachments/assets/8e01e7d9-1318-4218-aec6-c5d9bb49fb77" />
  <br/>
  <br/>
  <br/>


![SolveIt Dashboard](https://github.com/user-attachments/assets/bb5ee234-75cd-4e5d-9904-648dc25f7d7b)


---

## Features

### Task Management

* Create, browse, assign, and track tasks with attachments (PDFs, images)
* Task status workflow: `Open → In Progress → Completed`
* Search and filter tasks

### Payments & Subscriptions

* Escrow-based payments for secure transactions
* Subscription tiers for Solver features via Stripe

### Real-Time & Notifications

* Instant messaging between Posters and Solvers
* Task progress and deadline notifications

### AI & Mentoring 

* Automatic task categorization and content moderation
* Mentoring sessions with chat + video
* Integrated code and PDF viewer

---

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Frontend       | Next.js (App Router)                    |
| Backend        | Node.js, Go (WebSockets & APIs)         |
| Database       | PostgreSQL + Drizzle ORM                |
| Authentication | better auth                           |
| Payments       | Stripe (Subscriptions & Escrow)         |
| AI             | OpenAI API (Moderation, Classification) |
| Deployment     | Railway                                 |

---

## Project Structure

```
solveit-saas/
├── server/                         # Go backend
│   ├── bin/                        # Compiled executables
│   ├── cmd/                        # Go CLI entry points
│   ├── internal/
│   │   ├── api/                    # API routes & WebSocket hub
│   │   ├── db/                     # Database setup & migrations
│   │   ├── middleware/             # Logging & request middleware
│   │   ├── storage/                # File & SQL storage
│   │   ├── user/                   # User domain logic
│   │   ├── utils/                  # Utility functions
│   │   └── worker/                 # Background workers & deadlines
│   ├── makefile
│   └── tmp/                        # Build errors & temp files
├── src/                            # Next.js 
│   ├── app/
│   │   ├── (authentication)/       # Login & registration
│   │   ├── (marketing)/            # Landing & marketing pages
│   │   ├── dashboard/              # All dashboards by roles
│   │   │   ├── admin/              # Admin modules
│   │   │   ├── moderator/          # Moderator modules
│   │   │   ├── poster/             # Poster modules + mentorship
│   │   │   └── solver/             # Solver modules + mentorship
│   │   ├── error.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── not-found.tsx
│   ├── components/                 # UI components
│   │   ├── dashboard/              # Dashboard-specific components
│   │   ├── editors/                # Monaco & Rich Text editor
│   │   ├── marketing/              # Hero, features, CTA, footer, etc.
│   │   └── ui/                     # Reusable UI primitives
│   ├── contexts/                   # React context providers
│   ├── drizzle/                     # DB schemas, relations & seeds
│   ├── env/                        # Client/server environment configs
│   ├── features/                   # Feature modules (Ai, tasks, media, mentorship, payments, subscriptions, users, notifications)
│   ├── hooks/                       # Custom React hooks
│   ├── lib/                         # Utilities, logging, email, webrtc
│   ├── middleware.ts
│   ├── routes.ts
│   ├── store/                        # Global state (e.g., WebRTC)
│   └── styles/
├── LICENSE
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── types/                           # Type definitions
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/solveit.git
cd solveit

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run development server
npm run dev
cd .. & cd server
make run

# Open in browser
http://localhost:3000
```

---

## Screenshots

![Dashboard](https://github.com/user-attachments/assets/c9b08c9f-f487-44ec-b4cd-38ac3b72e714)
![Task View](https://github.com/user-attachments/assets/ea56984f-5c6b-42ba-a841-b2a0384b2e38)



---

## Roadmap

* PDF & 3D model viewer

---

## License

MIT License
