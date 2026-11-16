// A stock check asks about each item in turn. answers[i] is true when the
// i-th item has enough, so answers.length is also the current item's index.

export function nextAnswers(answers: boolean[], hasEnough: boolean, total: number): boolean[] {
  return answers.length >= total ? answers : [...answers, hasEnough];
}

export function previousAnswers(answers: boolean[]): boolean[] {
  return answers.slice(0, -1);
}

export function shortItemIds(itemIds: string[], answers: boolean[]): string[] {
  return itemIds.filter((_, index) => answers[index] === false);
}
