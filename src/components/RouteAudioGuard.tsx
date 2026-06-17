import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { stopTeacherSpeech } from "../services/teacherSpeech";

export default function RouteAudioGuard() {
  const location = useLocation();

  useEffect(() => {
    stopTeacherSpeech();
  }, [location.pathname]);

  return null;
}
