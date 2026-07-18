"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { QuizEditor } from "@/components/quiz/QuizEditor";

export default function EditQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("quiz");

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">{t("editTitle")}</h1>
      <QuizEditor quizId={id} />
    </div>
  );
}
