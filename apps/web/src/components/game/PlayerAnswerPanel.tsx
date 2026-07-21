"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import { cn } from "@/lib/cn";
import type { AnswerPayload, PublicQuestion } from "@/lib/types";

const COLORS = [
  "bg-coral-500",
  "bg-sky-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-400",
];

function SortableTile({
  id,
  text,
  imageId,
  color,
  disabled,
}: {
  id: string;
  text: string;
  imageId?: string | null;
  color: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Whole tile is the drag handle; touch-none stops the page from scrolling mid-drag.
      className={cn(
        "flex touch-none items-center gap-2 rounded-2xl px-4 py-4 text-white shadow-md select-none",
        color,
        disabled ? "opacity-60" : "cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-90 shadow-xl",
      )}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {!disabled && (
        <span className="shrink-0 opacity-90" aria-hidden>
          <GripVertical className="h-6 w-6" />
        </span>
      )}
      <MediaImage mediaId={imageId} alt="" className="h-12 w-12 rounded-lg object-cover" />
      <span className="flex-1 font-semibold">{text}</span>
    </div>
  );
}

export function PlayerAnswerPanel({
  question,
  locked,
  onSubmit,
}: {
  question: PublicQuestion;
  locked: boolean;
  onSubmit: (payload: AnswerPayload) => void;
}) {
  const t = useTranslations("play");
  const [selected, setSelected] = useState<string | null>(null);
  const [multi, setMulti] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>(() =>
    question.type === "puzzle"
      ? [...question.options].sort(() => Math.random() - 0.5).map((o) => o.id)
      : [],
  );

  // Distance constraint + touch-none on tiles: drag starts after a short move,
  // without the browser treating the gesture as page scroll.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const options = question.options;

  const submit = () => {
    if (locked) return;
    if (question.type === "quiz" || question.type === "true_false") {
      if (selected) onSubmit({ option_id: selected });
    } else if (question.type === "multi_select") {
      onSubmit({ option_ids: Array.from(multi) });
    } else if (question.type === "puzzle") {
      onSubmit({ ordered_option_ids: order });
    }
  };

  const canSubmit =
    !locked &&
    (((question.type === "quiz" || question.type === "true_false") && !!selected) ||
      (question.type === "multi_select" && multi.size > 0) ||
      (question.type === "puzzle" && order.length === options.length));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || locked) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  if (question.type === "puzzle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t("orderTiles")}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((id, i) => {
                const opt = options.find((o) => o.id === id)!;
                return (
                  <SortableTile
                    key={id}
                    id={id}
                    text={opt.text || `#${i + 1}`}
                    imageId={opt.image_id}
                    color={COLORS[i % COLORS.length]}
                    disabled={locked}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        {!locked && (
          <Button className="w-full" size="lg" onClick={submit} disabled={!canSubmit}>
            {t("submit")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.type === "multi_select" && (
        <p className="col-span-full text-sm text-slate-600">{t("selectMultiple")}</p>
      )}
      {options.map((opt, i) => {
        const color = COLORS[i % COLORS.length];
        const isSelected =
          question.type === "multi_select"
            ? multi.has(opt.id)
            : selected === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            disabled={locked}
            onClick={() => {
              if (question.type === "multi_select") {
                setMulti((prev) => {
                  const next = new Set(prev);
                  if (next.has(opt.id)) next.delete(opt.id);
                  else next.add(opt.id);
                  return next;
                });
              } else if (!locked) {
                setSelected(opt.id);
                onSubmit({ option_id: opt.id });
              }
            }}
            className={cn(
              "relative rounded-2xl px-4 py-5 text-left font-semibold text-white shadow-md transition active:scale-[0.98]",
              color,
              isSelected &&
                "scale-[1.02] brightness-110 ring-4 ring-slate-900 ring-offset-2 ring-offset-white shadow-xl",
              locked && "cursor-not-allowed opacity-60",
            )}
          >
            {isSelected && (
              <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            )}
            <MediaImage mediaId={opt.image_id} alt="" className="mb-2 h-16 w-full rounded-xl object-cover" />
            {opt.text}
          </button>
        );
      })}
      {/* quiz/true_false auto-submit on option click — no separate Submit button */}
      {!locked && question.type === "multi_select" && (
        <Button className="col-span-full" size="lg" onClick={submit} disabled={!canSubmit}>
          {t("submit")}
        </Button>
      )}
    </div>
  );
}

export function QuestionPrompt({ question }: { question: PublicQuestion }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-slate-800 sm:text-4xl">{question.text}</h2>
      <MediaImage mediaId={question.image_id} alt="" className="mx-auto mt-4" />
    </div>
  );
}
