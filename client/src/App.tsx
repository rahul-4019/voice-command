import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type LanguageCode =
  | 'en-US'
  | 'es-ES'
  | 'hi-IN'
  | 'fr-FR'
  | 'de-DE'
  | 'it-IT'
  | 'pt-BR'
  | 'zh-CN'

type IntentType = 'add' | 'remove' | 'modify' | 'search' | 'unknown'

interface ParsedCommand {
  intent: IntentType
  itemName?: string
  quantity?: number
  newQuantity?: number
  newItemName?: string
  priceMax?: number
  rawText: string
}

interface ShoppingItem {
  id: string
  name: string
  quantity: number
  category: string
}

interface SuggestionItem {
  name: string
  reason: string
}

const SpeechRecognitionImpl =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

function parseQuantity(text: string): number | undefined {
  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }

  const digitMatch = text.match(/(\d+)(?:\s+(?:items?|pieces?|bottles?|packs?|oranges?|apples?))?/i)
  if (digitMatch) return parseInt(digitMatch[1], 10)

  const wordMatch = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s+(?:items?|pieces?|bottles?|packs?|oranges?|apples?))?/i,
  )
  if (wordMatch) {
    const key = wordMatch[1].toLowerCase()
    return numberWords[key]
  }

  return undefined
}

function parsePriceMax(text: string): number | undefined {
  const match = text.match(/(?:under|below|less than)\s*\$?\s*(\d+(?:\.\d+)?)/i)
  if (match) return parseFloat(match[1])
  return undefined
}

function extractItemName(command: string, intent: IntentType): string | undefined {
  let text = command.toLowerCase()
  // Strip add-style prefixes
  text = text.replace(/(add|i (?:need|want to buy)|put|buy)\s+/g, '')
  // Strip remove-style prefixes and "from my list"
  text = text.replace(/(remove|delete|take off|clear)\s+/g, '')
  text = text.replace(/\s*(from|off)\s+my list|\s*(from|off)\s+the list/g, '')
  text = text.replace(/to my list|to the list|on my list|please|thanks?/g, '')
  text = text.replace(/\s+/g, ' ').trim()
  const qty = parseQuantity(text)
  if (qty !== undefined) {
    text = text.replace(/\b\d+\b/, '')
    text = text.replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
      '',
    )
    text = text.replace(/\b(items?|pieces?|bottles?|packs?|oranges?|apples?)\b/i, '')
    text = text.replace(/\s+/g, ' ').trim()
  }
  if (!text) return undefined
  return text
}

function parseModify(text: string): { itemName?: string; newQuantity?: number; newItemName?: string } {
  const lower = text.toLowerCase()
  // "change X to N" / "update X to N" / "set X to N"
  const toQtyMatch = lower.match(/(?:change|update|set|modify)\s+(.+?)\s+to\s+(\d+)\s*$/i)
  if (toQtyMatch) {
    const itemPart = toQtyMatch[1].replace(/\s*(quantity|amount|number)\s+of\s+/i, '').trim()
    return { itemName: itemPart || undefined, newQuantity: parseInt(toQtyMatch[2], 10) }
  }
  // "change X to Y" (rename)
  const toNameMatch = lower.match(/(?:change|update|replace)\s+(.+?)\s+to\s+(.+?)\s*$/i)
  if (toNameMatch) {
    const fromName = toNameMatch[1].replace(/\s*(quantity|amount|number)\s+of\s+/i, '').trim()
    const toName = toNameMatch[2].trim()
    if (fromName && toName && fromName !== toName) {
      return { itemName: fromName, newItemName: toName }
    }
  }
  return {}
}

function parseIntent(text: string): IntentType {
  const lower = text.toLowerCase()
  if (/(add|i need|i want to buy|put|buy)\b/.test(lower)) return 'add'
  if (/(remove|delete|take off|clear)\b/.test(lower)) return 'remove'
  if (/(change|update|set|modify|replace)\b/.test(lower)) return 'modify'
  if (/(find|search|look for)\b/.test(lower)) return 'search'
  return 'unknown'
}

function parseCommand(text: string): ParsedCommand {
  const intent = parseIntent(text)
  const quantity = parseQuantity(text)
  const priceMax = parsePriceMax(text)
  const itemName = extractItemName(text, intent)
  const modify = intent === 'modify' ? parseModify(text) : {}

  return {
    intent,
    itemName: itemName ?? modify.itemName,
    quantity,
    newQuantity: modify.newQuantity,
    newItemName: modify.newItemName,
    priceMax,
    rawText: text,
  }
}

function categorizeItem(name: string): string {
  const lower = name.toLowerCase()
  if (/(milk|cheese|yogurt|butter)/.test(lower)) return 'Dairy'
  if (/(apple|banana|orange|tomato|onion|lettuce|spinach)/.test(lower)) return 'Produce'
  if (/(bread|rice|pasta|cereal)/.test(lower)) return 'Grains'
  if (/(chips|cookies|snack|chocolate)/.test(lower)) return 'Snacks'
  if (/(soap|shampoo|toothpaste|detergent)/.test(lower)) return 'Household'
  return 'Other'
}

const SEASONAL_ITEMS: Record<number, string[]> = {
  0: ['oranges', 'hot chocolate'],
  1: ['strawberries', 'valentine chocolates'],
  2: ['asparagus', 'spring mix salad'],
  3: ['mangoes', 'iced tea'],
  4: ['watermelon', 'ice cream'],
  5: ['berries mix', 'grill sausages'],
  6: ['corn', 'lemonade'],
  7: ['peaches', 'iced coffee'],
  8: ['pumpkin', 'soup mix'],
  9: ['sweet potatoes', 'spices'],
  10: ['cranberries', 'stuffing mix'],
  11: ['cookies', 'baking chocolate'],
}

const SUBSTITUTES: Record<string, string[]> = {
  milk: ['almond milk', 'soy milk', 'oat milk'],
  bread: ['whole grain bread', 'gluten-free bread'],
  butter: ['olive oil spread', 'ghee'],
  sugar: ['brown sugar', 'honey'],
}

const CATALOG = [
  { name: 'organic apples', brand: 'Fresh Farms', price: 3.99 },
  { name: 'apples', brand: 'Local Orchard', price: 2.49 },
  { name: 'almond milk', brand: 'NutriGood', price: 4.5 },
  { name: 'regular milk', brand: 'DairyPure', price: 2.99 },
  { name: 'toothpaste', brand: 'SmileBright', price: 4.99 },
  { name: 'toothpaste', brand: 'BudgetClean', price: 2.49 },
]

function App() {
  const [language, setLanguage] = useState<LanguageCode>('en-US')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<typeof CATALOG>([])
  const [status, setStatus] = useState<string>('Tap the mic and speak a command.')
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  const recognitionRef = useRef<any | null>(null)

  const supportsSpeech = !!SpeechRecognitionImpl

  // Load initial state from backend (if available)
  useEffect(() => {
    async function loadFromBackend() {
      try {
        const res = await fetch('http://localhost:4000/api/state?userId=default')
        if (!res.ok) throw new Error('Bad status')
        const data = await res.json()
        if (Array.isArray(data.items)) {
          setItems(data.items)
        }
        if (Array.isArray(data.history)) {
          setHistory(data.history)
        }
        setBackendOnline(true)
        setStatus('Loaded your list from the server. Tap the mic and speak a command.')
      } catch {
        setBackendOnline(false)
      }
    }
    loadFromBackend()
  }, [])

  // Persist state to backend when items/history change
  useEffect(() => {
    if (backendOnline !== true) return
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetch('http://localhost:4000/api/state?userId=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, history }),
        signal: controller.signal,
      }).catch(() => {
        // best-effort; keep UI working even if save fails
      })
    }, 400)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [items, history, backendOnline])

  useEffect(() => {
    if (!supportsSpeech) return

    const recognition = new SpeechRecognitionImpl()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
      setStatus('Listening...')
      setTranscript('')
    }

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript as string
      setTranscript(text)
      setStatus('Processing command...')
      const parsed = parseCommand(text)
      setLastCommand(parsed)
      handleParsedCommand(parsed)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event)
      setStatus('Could not understand. Please try again.')
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (!transcript) {
        setStatus('No speech detected. Tap the mic to try again.')
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, supportsSpeech])

  function handleParsedCommand(cmd: ParsedCommand) {
    if (!cmd.itemName && cmd.intent !== 'unknown') {
      setStatus('I heard you, but could not detect the item name.')
      return
    }

    if (cmd.intent === 'add' && cmd.itemName) {
      const quantity = cmd.quantity ?? 1
      const name = cmd.itemName
      const category = categorizeItem(name)
      setItems((prev) => {
        const existing = prev.find((i) => i.name.toLowerCase() === name.toLowerCase())
        if (existing) {
          return prev.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i,
          )
        }
        return [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            quantity,
            category,
          },
        ]
      })
      setHistory((prev) => {
        const lower = name.toLowerCase()
        if (prev.includes(lower)) return prev
        return [...prev, lower]
      })
      setStatus(`Added ${quantity} ${name} to your list.`)
      return
    }

    if (cmd.intent === 'remove' && cmd.itemName) {
      const name = cmd.itemName.trim()
      setItems((prev) =>
        prev.filter((i) => i.name.toLowerCase() !== name.toLowerCase()),
      )
      setStatus(`Removed ${name} from your list.`)
      return
    }

    if (cmd.intent === 'modify' && cmd.itemName) {
      const name = cmd.itemName.trim()
      if (cmd.newQuantity !== undefined && cmd.newQuantity >= 0) {
        setItems((prev) =>
          prev.map((i) =>
            i.name.toLowerCase() === name.toLowerCase()
              ? { ...i, quantity: cmd.newQuantity! }
              : i,
          ),
        )
        setStatus(`Updated ${name} quantity to ${cmd.newQuantity}.`)
      } else if (cmd.newItemName && cmd.newItemName.trim()) {
        const newName = cmd.newItemName.trim()
        const category = categorizeItem(newName)
        setItems((prev) =>
          prev.map((i) =>
            i.name.toLowerCase() === name.toLowerCase()
              ? { ...i, name: newName, category }
              : i,
          ),
        )
        setStatus(`Changed ${name} to ${newName}.`)
      } else {
        setStatus('Say something like "Change milk to 3" or "Update milk to oat milk".')
      }
      return
    }

    if (cmd.intent === 'search' && cmd.itemName) {
      const name = cmd.itemName.toLowerCase()
      const results = CATALOG.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(name)
        const withinPrice =
          cmd.priceMax !== undefined ? c.price <= cmd.priceMax : true
        return matchesName && withinPrice
      })
      setSearchResults(results)
      if (results.length === 0) {
        setStatus('No items found that match your search.')
      } else {
        setStatus(`Found ${results.length} matching items.`)
      }
      return
    }

    setStatus("I couldn't recognize that command. Try saying 'Add milk' or 'Find apples under 5 dollars'.")
  }

  function handleMicClick() {
    if (!supportsSpeech) {
      setStatus('Your browser does not support speech recognition.')
      return
    }
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      recognitionRef.current?.start()
    }
  }

  const seasonalSuggestions: SuggestionItem[] = useMemo(() => {
    const month = new Date().getMonth()
    const items = SEASONAL_ITEMS[month] ?? []
    return items.map((name) => ({
      name,
      reason: 'Seasonal pick',
    }))
  }, [])

  const historySuggestions: SuggestionItem[] = useMemo(() => {
    return history
      .filter(
        (h) => !items.some((i) => i.name.toLowerCase() === h.toLowerCase()),
      )
      .slice(0, 5)
      .map((name) => ({
        name,
        reason: 'You often buy this',
      }))
  }, [history, items])

  const substituteSuggestions: SuggestionItem[] = useMemo(() => {
    if (!lastCommand?.itemName) return []
    const key = lastCommand.itemName.toLowerCase()
    const base = SUBSTITUTES[key]
    if (!base) return []
    return base.map((name) => ({
      name,
      reason: `Alternative to ${key}`,
    }))
  }, [lastCommand])

  function handleQuickAdd(name: string) {
    const parsed: ParsedCommand = {
      intent: 'add',
      itemName: name,
      quantity: 1,
      priceMax: undefined,
      rawText: `add ${name}`,
    }
    setLastCommand(parsed)
    handleParsedCommand(parsed)
  }

  function renderStatus() {
    return (
      <div className="status-bar">
        <span>{status}</span>
      </div>
    )
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>Voice Command Shopping Assistant</h1>
          <p className="subtitle">Shopping list with voice commands and suggestions.</p>
        </div>
        <div className="language-select">
          <label htmlFor="language">Language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          >
            <option value="en-US">English</option>
            <option value="es-ES">Español</option>
            <option value="hi-IN">हिन्दी</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
            <option value="it-IT">Italiano</option>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="zh-CN">中文 (简体)</option>
          </select>
        </div>
      </header>

      {renderStatus()}

      <main className="layout">
        <section className="voice-panel">
          <button
            type="button"
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={handleMicClick}
          >
            {isListening ? 'Stop' : 'Tap to Speak'}
          </button>
          <div className="transcript">
            <h2>Last heard</h2>
            <p>{transcript || '—'}</p>
          </div>
        </section>

        <section className="list-panel">
          <h2>Shopping List</h2>
          {items.length === 0 ? (
            <p className="empty">No items yet. Try saying "Add milk".</p>
          ) : (
            <ul className="item-list">
              {items.map((item) => (
                <li key={item.id} className="item-row">
                  <div>
                    <div className="item-main">
                      {item.name}{' '}
                      <span className="item-qty">×{item.quantity}</span>
                    </div>
                    <div className="item-meta">{item.category}</div>
                  </div>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() =>
                      handleParsedCommand({
                        intent: 'remove',
                        itemName: item.name,
                        quantity: undefined,
                        priceMax: undefined,
                        rawText: `remove ${item.name}`,
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="suggestions-panel">
          <h2>Suggestions</h2>

          <div className="suggestion-group">
            <h3>Because you often buy</h3>
            {historySuggestions.length === 0 ? (
              <p className="empty">No history yet. Add a few items first.</p>
            ) : (
              <div className="pill-list">
                {historySuggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="pill"
                    onClick={() => handleQuickAdd(s.name)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="suggestion-group">
            <h3>Seasonal picks</h3>
            <div className="pill-list">
              {seasonalSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="pill"
                  onClick={() => handleQuickAdd(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="suggestion-group">
            <h3>Substitutes</h3>
            {substituteSuggestions.length === 0 ? (
              <p className="empty">
                Try adding or removing an item like "milk" to see alternatives.
              </p>
            ) : (
              <div className="pill-list">
                {substituteSuggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="pill"
                    onClick={() => handleQuickAdd(s.name)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="suggestion-group">
            <h3>Search results</h3>
            {searchResults.length === 0 ? (
              <p className="empty">
                Say something like "Find me organic apples under 5 dollars".
              </p>
            ) : (
              <ul className="search-results">
                {searchResults.map((r, idx) => (
                  <li key={`${r.name}-${r.brand}-${idx}`}>
                    <div className="item-main">
                      {r.name} <span className="item-meta">{r.brand}</span>
                    </div>
                    <div className="item-meta">${r.price.toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>Tap the mic and speak to add, remove, or search items.</p>
      </footer>
    </div>
  )
}

export default App
