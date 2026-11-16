import { describe, expect, it } from 'vitest'
import { clarityAdvice, clarityIssues, questionHead, QUESTION_MAX } from './questionClarity'

// The turn-end spec §8: the question the operator could not read, 2026-11-16, word for word.
const SCREENSHOT = 'Запрос fabric-switchboard 3173118b (capability contract.change, срок 2026-11-23): схема и решение agent-health/1 для SB-393. Слот ответчика contract.change у fabric-agent-contract сейчас absent на поколении 9: ни одна служба проекта его не держит, поэтому прогон, запущенный на непрочитанные сообщения, запрос не берёт (не claim и не reply, чтобы не закрыть его без работы). Работа заведена строкой CT-336 (main 09a1aa92), цель 2026-11-19, ответ с номером строки и сроком уже в ветке (b9b7d153). Что открывает: прогон Fabric на сам запрос, который возьмёт слот contract.change (com.enroll) и выпустит DEC со схемой. Ответ не обязателен, если такой прогон и так будет запущен.'

describe('clarityIssues', () => {
  it('refuses the question the operator could not read, for every reason at once', () => {
    expect(clarityIssues(SCREENSHOT)).toEqual(['too-long', 'machine-words', 'not-a-question'])
  })
  it('takes a short question in plain words', () => {
    expect(clarityIssues('Запустить проверку контракта сейчас или подождать до четверга?')).toEqual([])
    expect(clarityIssues('Ship the new board screen to everyone today?')).toEqual([])
  })
  it('names machine words: ids, hashes, tickets, dotted names, paths and code', () => {
    for (const q of ['Слить ветку 09a1aa92?', 'Закрыть SB-393?', 'Взять слот contract.change?', 'Удалить src/main?', 'Запустить `ci.sh`?', 'Ответить на 3173118b-0000-4000-8000-000000000000?'])
      expect(clarityIssues(q), q).toContain('machine-words')
    expect(clarityIssues('Выпустить версию для всех, т.е. сегодня?')).toEqual([])
  })
  it('says how to ask instead', () => {
    const advice = clarityAdvice(['too-long', 'machine-words', 'not-a-question'])
    expect(advice).toContain(String(QUESTION_MAX))
    expect(advice).toContain('whyBlocked')
    expect(advice).toContain('decide it yourself')
  })
})

describe('questionHead', () => {
  it('keeps a readable question as it is, a question mark or not (it is asked of new questions only)', () => {
    expect(questionHead('Запустить проверку сейчас?')).toEqual({ headline: 'Запустить проверку сейчас?', more: null })
    expect(questionHead('Question q1')).toEqual({ headline: 'Question q1', more: null })
  })
  it('leads with the one clear question sentence of an unclear text, the rest behind details', () => {
    const text = 'Слот contract.change пуст на поколении 9. Запустить агента контракта сейчас?'
    expect(questionHead(text)).toEqual({ headline: 'Запустить агента контракта сейчас?', more: text })
  })
  it('has no headline for a text with no clear question, so the screen says it is unclear', () => {
    expect(questionHead(SCREENSHOT)).toEqual({ headline: null, more: SCREENSHOT })
  })
})
