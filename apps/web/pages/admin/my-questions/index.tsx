import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * The "Mina frågor" Översikt was retired (2026-07): content management is
 * consolidated into the single "Hantera innehåll" hub at /manage-content.
 * This route now just redirects there.
 */
export default function MyQuestionsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/manage-content");
  }, [router]);
  return <div className="p-8 text-gray-500">Omdirigerar…</div>;
}
