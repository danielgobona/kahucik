export type Locale = "en" | "sk";

export type QuestionType = "quiz" | "true_false" | "multi_select" | "puzzle";
export type QuizStatus = "draft" | "published" | "archived";
export type GameStatus =
  | "lobby"
  | "countdown"
  | "question_active"
  | "question_reveal"
  | "leaderboard"
  | "finished"
  | "cancelled";

export interface User {
  id: string;
  nickname: string;
  email: string;
  locale: Locale;
  created_at: string;
}

export interface MeResponse {
  user: User;
  csrf_token: string;
}

export interface OptionIn {
  id?: string;
  text: string;
  is_correct: boolean;
  correct_order?: number | null;
  image_id?: string | null;
}

export interface QuestionIn {
  id?: string;
  type: QuestionType;
  text: string;
  timer_seconds: number;
  image_id?: string | null;
  options: OptionIn[];
}

export interface OptionOut {
  id: string;
  text: string;
  is_correct: boolean;
  correct_order: number | null;
  image_id: string | null;
  position: number;
}

export interface QuestionOut {
  id: string;
  type: QuestionType;
  text: string;
  timer_seconds: number;
  image_id: string | null;
  position: number;
  options: OptionOut[];
}

export interface QuizOut {
  id: string;
  title: string;
  description: string;
  status: QuizStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  questions: QuestionOut[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  status: QuizStatus;
  question_count: number;
  updated_at: string;
}

export interface MediaOut {
  id: string;
  url: string;
  content_type: string;
  width: number;
  height: number;
  byte_size: number;
}

export interface GameOut {
  id: string;
  code: string;
  status: GameStatus;
  quiz_title: string;
  current_question_index: number;
  participant_count: number;
  join_url: string;
  created_at: string;
}

export interface JoinResponse {
  game_id: string;
  participant_id: string;
  reconnect_token: string;
  nickname: string;
  is_guest: boolean;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  rank: number;
  is_guest: boolean;
  user_id?: string | null;
  games_played?: number | null;
  wins?: number | null;
  average_score?: number | null;
}

export interface GameHistoryItem {
  game_id: string;
  quiz_title: string;
  score: number;
  rank: number;
  answers_correct: number;
  answers_total: number;
  finished_at: string | null;
  participants: number;
}

export interface PublicOption {
  id: string;
  text: string;
  image_id: string | null;
  position: number;
  is_correct?: boolean;
  correct_order?: number | null;
}

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  timer_seconds: number;
  image_id: string | null;
  position: number;
  options: PublicOption[];
}

export interface Participant {
  id: string;
  nickname: string;
  is_guest: boolean;
  score: number;
  connected: boolean;
  join_order: number;
}

export interface RankedParticipant extends Participant {
  rank: number;
  answers_correct?: number;
  answers_total?: number;
}

export interface GameSnapshot {
  game_id: string;
  code: string;
  status: GameStatus;
  quiz_title: string;
  current_question_index: number;
  participants: Participant[];
  deadline: number | null;
  started_at: string | null;
  answered: number;
  total_present: number;
  total_questions: number;
  role: "host" | "player" | "spectator";
  question?: PublicQuestion;
  correct?: Record<string, unknown>;
  leaderboard?: RankedParticipant[];
  me?: {
    id: string;
    nickname: string;
    score: number;
    is_guest: boolean;
  };
  my_submission?: {
    payload: AnswerPayload;
    is_correct: boolean | null;
    points_awarded: number | null;
    locked: boolean;
  };
  my_rank?: number;
}

export interface AnswerPayload {
  option_id?: string | null;
  option_ids?: string[];
  ordered_option_ids?: string[];
}

export interface ApiError {
  detail: string;
}
