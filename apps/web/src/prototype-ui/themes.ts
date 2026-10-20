// PROTOTYPE (throwaway, branch prototype/ui-busy): fake data for the busy-style UI prototype.
export type Lang = "pt-PT" | "es-ES" | "fr-FR";

export interface Line {
  speaker: "Partner" | "You";
  text: string;
  translation?: string;
}

export interface Theme {
  lang: Lang;
  name: string;
  short: string;
  body: string; // the Mascot's colour
  accent: string; // the flag's second colour, used for buttons
  onBody: string; // text colour on top of `body`
  hello: string;
  wellDone: string;
  hours: string;
  transcript: Line[];
}

export const THEMES: Record<Lang, Theme> = {
  "pt-PT": {
    lang: "pt-PT",
    name: "European Portuguese",
    short: "Portuguese",
    body: "#1F8A4C",
    accent: "#D7263D",
    onBody: "#FFFFFF",
    hello: "Olá!",
    wellDone: "Muito bem!",
    hours: "12 h 40",
    transcript: [
      { speaker: "Partner", text: "Olá! Eu gosto muito de futebol. E tu?", translation: "Hi! I really like football. And you?" },
      { speaker: "You", text: "Yes, I love it." },
      { speaker: "Partner", text: "Que bom! O meu clube é o Benfica. Tens um clube?", translation: "Great! My club is Benfica. Do you have a club?" },
      { speaker: "You", text: "Liverpool." },
      { speaker: "Partner", text: "O Liverpool! É uma equipa muito boa. Vais ao estádio?", translation: "Liverpool! It's a very good team. Do you go to the stadium?" },
    ],
  },
  "es-ES": {
    lang: "es-ES",
    name: "Castilian Spanish",
    short: "Spanish",
    body: "#F0A81C",
    accent: "#C8352A",
    onBody: "#141414",
    hello: "¡Hola!",
    wellDone: "¡Muy bien!",
    hours: "3 h 10",
    transcript: [
      { speaker: "Partner", text: "¡Hola! Me gusta mucho el fútbol. ¿Y a ti?", translation: "Hi! I really like football. And you?" },
      { speaker: "You", text: "Yes, I love it." },
      { speaker: "Partner", text: "¡Qué bien! Mi equipo es el Real Madrid. ¿Tienes un equipo?", translation: "Great! My team is Real Madrid. Do you have a team?" },
      { speaker: "You", text: "Liverpool." },
      { speaker: "Partner", text: "¡El Liverpool! Es un equipo muy bueno. ¿Vas al estadio?", translation: "Liverpool! It's a very good team. Do you go to the stadium?" },
    ],
  },
  "fr-FR": {
    lang: "fr-FR",
    name: "French",
    short: "French",
    body: "#2F55A4",
    accent: "#E2504A",
    onBody: "#FFFFFF",
    hello: "Bonjour !",
    wellDone: "Très bien !",
    hours: "0 h 00",
    transcript: [
      { speaker: "Partner", text: "Bonjour ! J'aime beaucoup le football. Et toi ?", translation: "Hello! I really like football. And you?" },
      { speaker: "You", text: "Yes, I love it." },
      { speaker: "Partner", text: "Super ! Mon équipe, c'est le PSG. Tu as une équipe ?", translation: "Great! My team is PSG. Do you have a team?" },
      { speaker: "You", text: "Liverpool." },
      { speaker: "Partner", text: "Liverpool ! C'est une très bonne équipe. Tu vas au stade ?", translation: "Liverpool! It's a very good team. Do you go to the stadium?" },
    ],
  },
};

export const LANGS: Lang[] = ["pt-PT", "es-ES", "fr-FR"];
export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export const TOPIC_SUGGESTIONS = ["your weekend", "food", "travel", "sport", "a film you liked", "your job"];
