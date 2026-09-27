"use client";

import { Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuestionCard } from "./question-card";
import { FormPreview } from "./form-preview";
import { AdvancedJsonSection } from "./advanced-json-section";
import {
  FormSchema,
  Question,
  createEmptyQuestion,
  parseSchema,
  serializeSchema,
  generateQuestionId,
} from "@/lib/interfaces/form-builder";

interface FormBuilderProps {
  initialSchema: string;
  onChange: (schemaString: string) => void;
}

export function FormBuilder({ initialSchema, onChange }: FormBuilderProps) {
  const [schema, setSchema] = useState<FormSchema>(() =>
    parseSchema(initialSchema),
  );

  // Keep latest onChange in a ref so the sync effect doesn't need it as a dep
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Update schema when initialSchema changes (e.g., template selection)
  useEffect(() => {
    const parsed = parseSchema(initialSchema);
    setSchema(parsed);
  }, [initialSchema]);

  // Sync schema changes to parent — only re-runs when schema changes
  useEffect(() => {
    const serialized = serializeSchema(schema);
    onChangeRef.current(serialized);
  }, [schema]);

  function handleAddQuestion() {
    setSchema((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));
  }

  function handleUpdateQuestion(index: number, updates: Partial<Question>) {
    setSchema((prev) => ({
      ...prev,
      questions: prev.questions.map((q, idx) =>
        idx === index ? { ...q, ...updates } : q,
      ),
    }));
  }

  function handleDuplicateQuestion(index: number) {
    const questionToDuplicate = schema.questions[index];
    const duplicated: Question = {
      ...questionToDuplicate,
      id: generateQuestionId(),
      title: `${questionToDuplicate.title} (복사본)`,
    };
    setSchema((prev) => ({
      ...prev,
      questions: [
        ...prev.questions.slice(0, index + 1),
        duplicated,
        ...prev.questions.slice(index + 1),
      ],
    }));
  }

  function handleDeleteQuestion(index: number) {
    setSchema((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== index),
    }));
  }

  function handleMoveQuestion(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schema.questions.length) return;

    setSchema((prev) => {
      const newQuestions = [...prev.questions];
      [newQuestions[index], newQuestions[targetIndex]] = [
        newQuestions[targetIndex],
        newQuestions[index],
      ];
      return { ...prev, questions: newQuestions };
    });
  }

  function handleJsonChange(newJson: string) {
    try {
      const parsed = parseSchema(newJson);
      setSchema(parsed);
    } catch (error: any) {
      console.error("Failed to parse JSON:", error);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* Left: Edit Section */}
      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle className="text-sm">질문 편집</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="h-[600px] w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-4">
            <div className="w-full min-w-0 max-w-full space-y-4">
              {schema.questions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p className="text-sm">아래 버튼으로 질문을 추가해보세요.</p>
                </div>
              )}

              {schema.questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  onUpdate={(updates) => handleUpdateQuestion(index, updates)}
                  onDuplicate={() => handleDuplicateQuestion(index)}
                  onDelete={() => handleDeleteQuestion(index)}
                  onMoveUp={() => handleMoveQuestion(index, "up")}
                  onMoveDown={() => handleMoveQuestion(index, "down")}
                  canMoveUp={index > 0}
                  canMoveDown={index < schema.questions.length - 1}
                />
              ))}

              <Button
                type="button"
                onClick={handleAddQuestion}
                variant="outline"
                className="w-full border-dashed border-2 h-12"
              >
                <Plus className="mr-2 h-4 w-4" />
                질문 추가
              </Button>

              <Separator className="my-4" />

              <AdvancedJsonSection
                jsonString={serializeSchema(schema)}
                onJsonChange={handleJsonChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right: Preview Section */}
      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle className="text-sm">미리보기</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="h-150 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-4">
            <div className="w-full min-w-0 max-w-full">
              <FormPreview schema={schema} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
