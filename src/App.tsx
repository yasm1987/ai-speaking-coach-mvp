import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/UI";
import RouteAudioGuard from "./components/RouteAudioGuard";
import DialoguePage from "./pages/DialoguePage";
import ErrorsPage from "./pages/ErrorsPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import PracticePage from "./pages/PracticePage";
import ReportPage from "./pages/ReportPage";
import ReviewPage from "./pages/ReviewPage";
import TasksPage from "./pages/TasksPage";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <RouteAudioGuard />
      <NavBar />
      <main className="mx-auto w-full max-w-[960px] px-4 pb-12 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/dialogue" element={<DialoguePage />} />
          <Route path="/errors" element={<ErrorsPage />} />
          <Route path="/review/:id" element={<ReviewPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  );
}
