"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Trash2, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { MediaImage } from "@/components/ui/MediaImage";
import { api, ApiClientError } from "@/lib/api";
import type { QuestionIn, QuestionType, QuizOut } from "@/lib/types";
import { cn } from "@/lib/cn";

type QuizDraft = {
  title: string;
  description: string;
  questions: QuestionIn[];
  openIndex: number | null;
};

function draftKey(quizId?: string) {
  return `kahucik_quiz_draft_${quizId ?? "new"}`;
}

function readDraft(quizId?: string): QuizDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(quizId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as QuizDraft;
    if (!draft || !Array.isArray(draft.questions)) return null;
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(quizId: string | undefined, draft: QuizDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(draftKey(quizId), JSON.stringify(draft));
}

function clearDraft(quizId?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(quizId));
}

function clampTimer(value: number): number {
  if (!Number.isFinite(value) || value < 5) return 20;
  if (value > 240) return 240;
  return Math.round(value);
}

function defaultOptions(type: QuestionType): QuestionIn["options"] {
  if (type === "true_false") {
    return [
      { text: "True", is_correct: true },
      { text: "False", is_correct: false },
    ];
  }
  if (type === "puzzle") {
    return ["First", "Second", "Third", "Fourth"].map((text, i) => ({
      text,
      is_correct: false,
      correct_order: i,
    }));
  }
  return [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ].slice(0, type === "multi_select" ? 4 : 4);
}

function newQuestion(type: QuestionType = "quiz"): QuestionIn {
  return {
    type,
    text: "",
    timer_seconds: 20,
    options: defaultOptions(type),
  };
}

function initialDraft(quizId?: string): QuizDraft {
  const draft = readDraft(quizId);
  if (draft) {
    return {
      title: draft.title,
      description: draft.description,
      questions: draft.questions.length ? draft.questions : [newQuestion()],
      openIndex: draft.openIndex,
    };
  }
  return {
    title: "",
    description: "",
    questions: [newQuestion()],
    openIndex: null,
  };
}

function typeLabel(
  type: QuestionType,
  t: ReturnType<typeof useTranslations<"quiz">>,
) {
  switch (type) {
    case "true_false":
      return t("typeTrueFalse");
    case "multi_select":
      return t("typeMultiSelect");
    case "puzzle":
      return t("typePuzzle");
    default:
      return t("typeQuiz");
  }
}

function SortableQuestion({
  id,
  index,
  question,
  open,
  onToggle,
  onChange,
  onRemove,
  t,
}: {
  id: string;
  index: number;
  question: QuestionIn;
  open: boolean;
  onToggle: () => void;
  onChange: (q: QuestionIn) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations<"quiz">>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const setType = (type: QuestionType) => {
    onChange({ ...question, type, options: defaultOptions(type) });
  };

  const uploadImage = async (file: File, target: "question" | number) => {
    const media = await api.uploadMedia(file);
    if (target === "question") {
      onChange({ ...question, image_id: media.id });
    } else {
      const options = [...question.options];
      options[target] = { ...options[target], image_id: media.id };
      onChange({ ...question, options });
    }
  };

  const preview = question.text.trim() || t("questionUntitled");

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="mb-4 border-l-4 border-l-coral-400 p-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            className="cursor-grab text-slate-400 hover:text-slate-600"
            aria-label="Drag"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={onToggle}
            aria-expanded={open}
          >
            <span className="shrink-0 font-semibold text-slate-700">#{index + 1}</span>
            <span className="min-w-0 truncate text-sm text-slate-600">{preview}</span>
            <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 sm:inline">
              {typeLabel(question.type, t)}
            </span>
            <ChevronDown
              className={cn(
                "ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("deleteQuestion")}</span>
          </Button>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="space-y-3 border-t border-slate-100 px-5 py-4"
              inert={!open ? true : undefined}
            >
              <Select
                className="max-w-[220px]"
                value={question.type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                options={[
                  { value: "quiz", label: t("typeQuiz") },
                  { value: "true_false", label: t("typeTrueFalse") },
                  { value: "multi_select", label: t("typeMultiSelect") },
                  { value: "puzzle", label: t("typePuzzle") },
                ]}
              />
              <Input
                label={t("questionText")}
                value={question.text}
                onChange={(e) => onChange({ ...question, text: e.target.value })}
                maxLength={240}
              />
              <Input
                label={t("timer")}
                type="number"
                min={5}
                max={240}
                placeholder="20"
                value={question.timer_seconds || ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({
                    ...question,
                    timer_seconds: raw === "" ? 0 : Number(raw),
                  });
                }}
                onBlur={() => {
                  const next = clampTimer(question.timer_seconds);
                  if (next !== question.timer_seconds) {
                    onChange({ ...question, timer_seconds: next });
                  }
                }}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-coral-600">
                <ImagePlus className="h-4 w-4" />
                {t("uploadImage")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f, "question");
                  }}
                />
              </label>
              {question.image_id ? (
                <>
                  <MediaImage mediaId={question.image_id} className="max-h-32" />
                  <button
                    type="button"
                    className="text-xs text-rose-500"
                    onClick={() => onChange({ ...question, image_id: null })}
                  >
                    {t("removeImage")}
                  </button>
                </>
              ) : null}

              <div className="space-y-2">
                {question.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-xl border p-2",
                      opt.is_correct && question.type !== "puzzle"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200",
                    )}
                  >
                    {question.type === "puzzle" ? (
                      <span className="w-8 text-center text-sm font-bold text-slate-500">
                        {oi + 1}
                      </span>
                    ) : (
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type={question.type === "multi_select" ? "checkbox" : "radio"}
                          name={`correct-${id}`}
                          checked={opt.is_correct}
                          onChange={() => {
                            const options = question.options.map((o, i) => {
                              if (question.type === "multi_select") {
                                return i === oi ? { ...o, is_correct: !o.is_correct } : o;
                              }
                              return { ...o, is_correct: i === oi };
                            });
                            onChange({ ...question, options });
                          }}
                        />
                        {t("correct")}
                      </label>
                    )}
                    <Input
                      className="flex-1"
                      value={opt.text}
                      onChange={(e) => {
                        const options = [...question.options];
                        options[oi] = { ...options[oi], text: e.target.value };
                        onChange({ ...question, options });
                      }}
                      maxLength={120}
                      placeholder={t("optionText")}
                    />
                    <label className="cursor-pointer text-coral-500">
                      <ImagePlus className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadImage(f, oi);
                        }}
                      />
                    </label>
                  </div>
                ))}
                {(question.type === "multi_select" || question.type === "puzzle") &&
                  question.options.length < 6 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onChange({
                          ...question,
                          options: [
                            ...question.options,
                            {
                              text: "",
                              is_correct: false,
                              correct_order:
                                question.type === "puzzle"
                                  ? question.options.length
                                  : undefined,
                            },
                          ],
                        })
                      }
                    >
                      {t("addOption")}
                    </Button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function QuizEditor({
  quizId,
  onSaved,
}: {
  quizId?: string;
  onSaved?: (quiz: QuizOut) => void;
}) {
  const t = useTranslations("quiz");
  const tc = useTranslations("common");
  const router = useRouter();
  const [title, setTitle] = useState(() => {
    const draft = initialDraft(quizId);
    return draft.title;
  });
  const [description, setDescription] = useState(() => initialDraft(quizId).description);
  const [questions, setQuestions] = useState<QuestionIn[]>(
    () => initialDraft(quizId).questions,
  );
  const [openIndex, setOpenIndex] = useState<number | null>(
    () => initialDraft(quizId).openIndex,
  );
  const [status, setStatus] = useState<string>("draft");
  const [loading, setLoading] = useState(!!quizId);
  const [hydrated, setHydrated] = useState(!quizId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qIds = questions.map((_, i) => `q-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!quizId) return;

    let cancelled = false;
    const draft = readDraft(quizId);

    api
      .getQuiz(quizId)
      .then((quiz) => {
        if (cancelled) return;
        setStatus(quiz.status);
        if (draft) {
          setTitle(draft.title);
          setDescription(draft.description);
          setQuestions(draft.questions.length ? draft.questions : [newQuestion()]);
          setOpenIndex(draft.openIndex);
          return;
        }
        setTitle(quiz.title);
        setDescription(quiz.description);
        setQuestions(
          quiz.questions.map((q) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            timer_seconds: q.timer_seconds,
            image_id: q.image_id,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              is_correct: o.is_correct,
              correct_order: o.correct_order,
              image_id: o.image_id,
            })),
          })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        if (draft) {
          setTitle(draft.title);
          setDescription(draft.description);
          setQuestions(draft.questions.length ? draft.questions : [newQuestion()]);
          setOpenIndex(draft.openIndex);
          return;
        }
        setError(err instanceof ApiClientError ? err.detail : tc("error"));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, tc]);

  useEffect(() => {
    if (!hydrated || loading) return;
    writeDraft(quizId, { title, description, questions, openIndex });
  }, [title, description, questions, openIndex, quizId, hydrated, loading]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = qIds.indexOf(String(active.id));
    const newIndex = qIds.indexOf(String(over.id));
    setQuestions(arrayMove(questions, oldIndex, newIndex));
    setOpenIndex((current) => {
      if (current === null) return null;
      if (current === oldIndex) return newIndex;
      if (oldIndex < newIndex && current > oldIndex && current <= newIndex) {
        return current - 1;
      }
      if (oldIndex > newIndex && current >= newIndex && current < oldIndex) {
        return current + 1;
      }
      return current;
    });
  };

  const save = useCallback(async () => {
    if (!title.trim()) {
      setMessage(null);
      setError(t("validationTitle"));
      return;
    }
    const normalized = questions.map((q) => ({
      ...q,
      timer_seconds: clampTimer(q.timer_seconds),
    }));
    const invalid = normalized.some(
      (q) =>
        !q.text.trim() ||
        q.options.length < 2 ||
        (q.type !== "puzzle" && !q.options.some((o) => o.is_correct)),
    );
    if (invalid) {
      setMessage(null);
      setError(t("validationQuestion"));
      return;
    }
    setQuestions(normalized);
    setSaving(true);
    setError(null);
    try {
      let quiz: QuizOut;
      if (quizId) {
        quiz = await api.updateQuiz(quizId, {
          title,
          description,
          questions: normalized,
        });
      } else {
        quiz = await api.createQuiz({ title, description });
        if (normalized.length) {
          quiz = await api.updateQuiz(quiz.id, { questions: normalized });
        }
        clearDraft("new");
      }
      clearDraft(quizId ?? quiz.id);
      setStatus(quiz.status);
      setMessage(t("saveSuccess"));
      setError(null);
      onSaved?.(quiz);
      return quiz;
    } catch (err) {
      setMessage(null);
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setSaving(false);
    }
  }, [title, description, questions, quizId, t, tc, onSaved]);

  const publish = async () => {
    const quiz = await save();
    if (!quiz) return;
    try {
      const published = await api.publishQuiz(quiz.id);
      setStatus(published.status);
      setMessage(t("publishSuccess"));
      setError(null);
    } catch (err) {
      setMessage(null);
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    }
  };

  const host = async () => {
    const quiz = await save();
    if (!quiz) return;
    try {
      let ready = quiz;
      if (ready.status !== "published") {
        ready = await api.publishQuiz(ready.id);
        setStatus(ready.status);
      }
      const game = await api.hostGame(ready.id);
      router.push(`/host/${game.id}`);
    } catch (err) {
      setMessage(null);
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    }
  };

  if (loading) return <p className="text-slate-500">{tc("loading")}</p>;

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <Input label={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          label={t("description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Card>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={qIds} strategy={verticalListSortingStrategy}>
          {questions.map((q, i) => (
            <SortableQuestion
              key={qIds[i]}
              id={qIds[i]}
              index={i}
              question={q}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              t={t}
              onChange={(updated) => {
                const next = [...questions];
                next[i] = updated;
                setQuestions(next);
              }}
              onRemove={() => {
                setQuestions(questions.filter((_, j) => j !== i));
                setOpenIndex((current) => {
                  if (current === null) return null;
                  if (current === i) return null;
                  if (current > i) return current - 1;
                  return current;
                });
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="secondary"
        onClick={() => {
          setQuestions([...questions, newQuestion()]);
          setOpenIndex(questions.length);
        }}
      >
        {t("addQuestion")}
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          {saving ? t("saving") : t("save")}
        </Button>
        {status !== "published" && (
          <Button variant="success" onClick={() => void publish()}>
            {t("publish")}
          </Button>
        )}
        {quizId && (
          <Button variant="secondary" onClick={() => void host()}>
            {t("hostAfterPublish")}
          </Button>
        )}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {!error && message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      </div>
    </div>
  );
}
