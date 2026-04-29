import { CORPUS, type Doc } from "./corpus";

export type SearchHit = {
  id: string;
  title: string;
  category: Doc["category"];
  snippet: string;
  score: number;
};

const STOPWORDS = new Set([
  "の", "は", "が", "を", "に", "で", "と", "た", "て", "です", "ます",
  "こと", "もの", "そう", "など", "について", "教え", "ください",
  "the", "a", "an", "of", "to", "in", "is", "are", "and", "or",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s、。,.!?！？「」（）()【】\[\]:：;；/\\]+/u)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

export function searchCorpus(query: string, topK = 3): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const scored: SearchHit[] = CORPUS.map((doc) => {
    const haystack = (doc.title + "\n" + doc.content).toLowerCase();
    let score = 0;
    for (const term of terms) {
      const occurrences = haystack.split(term).length - 1;
      score += occurrences;
    }
    const firstHit = terms
      .map((t) => haystack.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    const snippet =
      firstHit !== undefined
        ? doc.content.slice(Math.max(0, firstHit - 40), firstHit + 160)
        : doc.content.slice(0, 160);
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      snippet,
      score,
    };
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export function getDocById(id: string): Doc | undefined {
  return CORPUS.find((d) => d.id === id);
}
