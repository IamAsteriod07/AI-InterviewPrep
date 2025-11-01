# 🎤 InterviewPrep

InterviewPrep is an AI-powered mock interview coach built with Next.js, Mantine, and Tailwind CSS. Pair up with a real-time interviewing agent, practice curated technical and behavioral sessions, and receive structured, data-backed feedback so you can level up before your next real interview.

## 🖼️ Preview
<div align="center">
  <img src="./public/readme/hero-preview.png" alt="InterviewPrep hero section with AI interviewer robot" width="100%" />
</div>

## ✨ Features
- **AI Voice Interviewer** – conduct live interview sessions powered by Vapi voice workflows and Google Gemini evaluations.
- **Dynamic Interview Library** – browse available practice sessions or revisit historical interviews tailored to your stack.
- **Structured Feedback Reports** – get category scores, strengths, and improvement areas after each session.
- **Tech Stack Visuals** – auto-detected technology icons for every interview using Devicon CDN fallbacks.
- **Secure Auth Flow** – Firebase Authentication with session cookies guards all protected routes.

## 🧱 Tech Stack
- `Next.js` App Router
- `React 19` with Client/Server Components
- `Mantine` component primitives via custom styling
- `Tailwind CSS 4` + `tailwindcss-animate`
- `Vapi` voice-agent SDK
- `Google Gemini 2.0 Flash` via `@ai-sdk/google`
- `Firebase` (Auth + Firestore)
- `Day.js`, `Zod`, `React Hook Form`

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- npm 9+
- Firebase project with Admin credentials
- Vapi account with created workflow & web token

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables
Create `.env.local` in the project root:
```bash
NEXT_PUBLIC_VAPI_WEB_TOKEN=your_vapi_web_token
NEXT_PUBLIC_VAPI_WORKFLOW_ID=your_vapi_workflow_id

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_admin_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Note:** Escape newlines in `FIREBASE_PRIVATE_KEY` with `\n` or load from a secrets manager.

### 4. Run the dev server
```bash
npm run dev
```

Visit `http://localhost:3000` to explore the app.

## 📁 Project Structure
```
app/
  layout.tsx
  globals.css
  (auth)/
    layout.tsx
    sign-in/page.tsx
    sign-up/page.tsx
  (root)/
    layout.tsx
    page.tsx
    interview/
      page.tsx
      [id]/page.tsx
      [id]/feedback/page.tsx
components/
  Agent.tsx
  AuthForm.tsx
  DisplayTechIcons.tsx
  InterviewCard.tsx
  FormField.tsx
  ui/
    button.tsx
    form.tsx
    input.tsx
    label.tsx
    sonner.tsx
constants/
firebase/
lib/
  actions/
  utils.ts
  vapi.sdk.ts
types/
```

## 🔐 Authentication Flow
- Auth pages live under `app/(auth)`; authenticated sessions redirect back to the dashboard.
- Protected routes render through `app/(root)` and check `isAuthenticated()` on the server.
- Successful sign-ins store Firebase session cookies (`setSessionCookie`) for gated access.

## 🧠 AI Interview Lifecycle
1. User joins an interview (`Agent` component) and starts a Vapi voice call.
2. Transcripts stream back and persist in React state until the call ends.
3. On completion, transcripts post to the server action `createFeedback`.
4. Google Gemini evaluates the transcript against `feedbackSchema` and saves to Firestore.
5. Users review detailed feedback in `app/(root)/interview/[id]/feedback/page.tsx`.

## 🛠️ Available Scripts
- `npm run dev` – start Next.js dev server
- `npm run build` – build for production
- `npm run start` – run production build
- `npm run lint` – run ESLint (Next.js config)

## 🧪 Testing Notes
Currently no automated tests are configured. Consider integrating Playwright for end-to-end interview flows and Vitest for action-level unit tests.

## 🗺️ Future Enhancements
- Interactive dashboard analytics on interview performance trends.
- Support for custom interview creation with question templates.
- Expanded AI feedback with sample answers and coach tips.
- Exportable feedback reports (PDF/email).

## 🤝 Contributing
1. Fork the repo & create a feature branch
2. Ensure lint passes: `npm run lint`
3. Open a pull request describing your changes

## 📄 License
This project is licensed under the MIT License.
