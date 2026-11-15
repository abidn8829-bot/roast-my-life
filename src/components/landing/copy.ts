/**
 * Every word on the landing page lives here, so copy is edited in one place.
 * Do not add claims here that are not approved copy (no counts, ratings or testimonials).
 */

export type LinkCopy = { label: string; href: string };
export type ItemCopy = { title: string; text: string };

const SIGNUP: LinkCopy = { label: "Get my first roast", href: "/signup" };
const START_NOTE = "Free. Five questions. No card.";

export const NAV = {
  wordmark: "Ember",
  howItWorks: { label: "How it works", href: "#how-it-works" } as LinkCopy,
  logIn: { label: "Log in", href: "/login" } as LinkCopy,
  cta: SIGNUP,
};

export const HERO = {
  label: "AI accountability, with jokes",
  heading: "You said nine hours of screen time like it was a personality.",
  /** The one word in the heading that gets the hand-drawn underline. Must appear in `heading`. */
  underlineWord: "personality",
  body: "Ember is an AI that grades your habits and roasts the gap between what you planned and what you did. Five questions to start. One check-in a day.",
  cta: SIGNUP,
  note: START_NOTE,
  /** Handwritten aside next to the hero button (decorative joke, not a claim). */
  handNote: "yes, it will judge you",
};

export const WHY = {
  id: "why",
  label: "Why bother",
  heading: "Nobody checks your homework anymore.",
  items: [
    {
      title: "Plans are easy. Tuesdays are hard.",
      text: "You already know what to do. Nobody asks whether you did it.",
    },
    {
      title: "A note can't follow up.",
      text: "Ember asks one question a day and remembers what you said last time.",
    },
    {
      title: "A number that moves.",
      text: "Five grades and a score out of 100. \"I'm doing better\" becomes something you can check.",
    },
  ] as ItemCopy[],
};

export const HOW = {
  id: "how-it-works",
  label: "How it works",
  heading: "Three steps. That's the whole thing.",
  steps: [
    {
      title: "Answer five questions.",
      text: "Phone hours, the app that eats them, sleep, delivery spending, and the promise you keep breaking.",
    },
    {
      title: "Get roasted and graded.",
      text: "A roast written from your answers. Five grades. A Life Score out of 100. A short plan for tomorrow.",
    },
    {
      title: "Check in tomorrow.",
      text: "One question about how it went. The grades move. So does the roast.",
    },
  ] as ItemCopy[],
  cta: SIGNUP,
};

export const FINAL_CTA = {
  heading: "Find out what your week looks like to someone else.",
  cta: SIGNUP,
  note: START_NOTE,
};

export const FOOTER = {
  wordmark: "Ember",
  links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "What is Ember AI?", href: "/what-is-ember-ai" },
  ] as LinkCopy[],
};
