export type TournamentFormat = 'knockout' | 'round_robin';

export type TournamentConfig = {
  name: string;
  numberOfCourts: number;
  matchDuration: number;
};

export type Participant = {
  id: string;
  name: string;
};

export type Match = {
  id: string;
  round: number;
  matchOrder: number;
  player1Id: string | null;
  player2Id: string | null;
  score1: number | '';
  score2: number | '';
  winnerId: string | null;
  nextMatchId: string | null;
  nextMatchSlot?: 1 | 2;
  isBye: boolean;
  customTime?: string;
};

export type TournamentState = 'registration' | 'active' | 'completed';

export type Category = {
  id: string;
  name: string;
  players: Participant[];
  matches: Match[];
  tournamentState: TournamentState;
  format: TournamentFormat;
  totalRounds: number;
};

export type AppState = {
  config: TournamentConfig;
  categories: Category[];
  activeCategoryId: string;
  lang: 'en' | 'th';
};
