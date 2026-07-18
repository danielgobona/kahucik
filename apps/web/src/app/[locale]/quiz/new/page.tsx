"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { QuizEditor } from "@/components/quiz/QuizEditor";

export default function NewQuizPage() {
  const t = useTranslations("quiz");
  const router = useRouter();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">{t("newTitle")}</h1>
      <QuizEditor
        onSaved={(quiz) => {
          router.replace(`/quiz/${quiz.id}`);
        }}
      />
    </div>
  );
}
