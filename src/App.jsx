import React, { useEffect, useMemo, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'
import {
  ClipboardPaste,
  Edit3,
  MoonStar,
  Pin,
  Search,
  ChefHat,
  Plus,
  Trash2,
  Upload,
  BookOpen,
  CheckSquare,
  Square,
  X,
} from 'lucide-react'

const demoRecipes = [
  {
    id: 1,
    title: 'Creamy Lemon Chicken Pasta',
    source: 'Instagram screenshot',
    tags: ['Dinner', 'Quick', 'Favourites'],
    pinned: true,
    servings: '4',
    unitPreference: 'cups-spoons',
    ingredients: [
      '2 chicken breasts, sliced',
      '2 tbsp olive oil',
      '3 cloves garlic, minced',
      '1 cup cream',
      '1/2 cup grated parmesan',
      '250 g pasta',
      '1 tbsp lemon zest',
      '2 tbsp lemon juice',
      'Salt and black pepper',
    ],
    steps: [
      'Cook pasta in salted water until al dente.',
      'Pan-fry chicken in olive oil until golden and cooked through.',
      'Add garlic, then stir in cream, parmesan, zest, and juice.',
      'Toss through pasta and season to taste.',
    ],
    notes: 'Could convert pasta amount to cups if you prefer volume-first notes.',
    rawText: '',
  },
  {
    id: 2,
    title: 'Soft Banana Pikelets',
    source: 'Pasted text',
    tags: ['Baking', 'Kids'],
    pinned: false,
    servings: '3',
    unitPreference: 'cups-spoons',
    ingredients: [
      '1 cup self-raising flour',
      '1 tbsp sugar',
      '1 ripe banana, mashed',
      '1 egg',
      '3/4 cup milk',
      '1 tbsp butter, melted',
    ],
    steps: [
      'Whisk all ingredients into a smooth batter.',
      'Cook spoonfuls in a buttered pan over medium heat.',
      'Flip when bubbles appear and cook until golden.',
    ],
    notes: 'Great for lunchboxes.',
    rawText: '',
  },
]

const palette = {
  bg: '#e9eef3',
  panel: '#f6f8fb',
  card: '#ffffff',
  border: '#c8d3df',
  text: '#243447',
  subtext: '#5e7288',
  accent: '#738ca6',
  accentDeep: '#5e7893',
  accentSoft: '#dbe5ef',
}

function parseRecipeText(text) {
  const cleaned = text.trim()
  if (!cleaned) return null

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const title = lines[0] || 'Imported recipe'
  const lower = cleaned.toLowerCase()
  let ingredients = []
  let steps = []

  const ingredientsMatch = cleaned.match(/ingredients[:\s]*([\s\S]*?)(method|instructions|directions|steps)[:\s]/i)
  const stepsMatch = cleaned.match(/(?:method|instructions|directions|steps)[:\s]*([\s\S]*)/i)

  if (ingredientsMatch) {
    ingredients = ingredientsMatch[1]
      .split(/\n|•|\-/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (stepsMatch) {
    steps = stepsMatch[1]
      .split(/\n|\d+\.|•/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (!ingredients.length && !steps.length) {
    const likelyIngredients = lines.filter((line) => /\b(cup|cups|tbsp|tsp|teaspoon|tablespoon|g|kg|ml|l|egg|clove)\b/i.test(line))
    ingredients = likelyIngredients
    steps = lines.filter((line) => !likelyIngredients.includes(line)).slice(1)
  }

  return {
    title,
    source: 'Imported text',
    tags: [lower.includes('bake') ? 'Baking' : 'Imported'],
    pinned: false,
    servings: '',
    unitPreference: 'cups-spoons',
    ingredients,
    steps,
    notes: '',
    rawText: cleaned,
  }
}

function joinForEdit(items) {
  return items.join('\n')
}

function splitFromEdit(text) {
  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function useWakeLock(enabled) {
  const lockRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function requestLock() {
      try {
        if (enabled && 'wakeLock' in navigator) {
          lockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch (error) {
        console.warn('Wake lock unavailable', error)
      }
    }

    if (enabled) requestLock()

    const onVisibility = async () => {
      if (!cancelled && enabled && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try {
          lockRef.current = await navigator.wakeLock.request('screen')
        } catch (error) {
          console.warn(error)
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (lockRef.current) {
        lockRef.current.release().catch(() => {})
      }
    }
  }, [enabled])
}

function Modal({ open, title, description, children, onClose, maxWidth = '780px' }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function RecipeForm({ draft, setDraft, onSave, onCancel }) {
  return (
    <div className="form-grid">
      <div className="form-row two-up">
        <label>
          <span>Title</span>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label>
          <span>Source</span>
          <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
        </label>
      </div>

      <div className="form-row three-up">
        <label>
          <span>Servings</span>
          <input value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: e.target.value })} />
        </label>
        <label>
          <span>Tags</span>
          <input
            value={draft.tagsText ?? draft.tags.join(', ')}
            onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
            placeholder="Dinner, Baking, Quick"
          />
        </label>
        <label>
          <span>Units</span>
          <select value={draft.unitPreference} onChange={(e) => setDraft({ ...draft, unitPreference: e.target.value })}>
            <option value="cups-spoons">Cups and spoons first</option>
            <option value="mixed">Mixed units</option>
            <option value="metric">Metric first</option>
          </select>
        </label>
      </div>

      <label>
        <span>Ingredients</span>
        <textarea
          value={draft.ingredientsText ?? joinForEdit(draft.ingredients)}
          onChange={(e) => setDraft({ ...draft, ingredientsText: e.target.value })}
          rows={8}
        />
      </label>

      <label>
        <span>Method</span>
        <textarea value={draft.stepsText ?? joinForEdit(draft.steps)} onChange={(e) => setDraft({ ...draft, stepsText: e.target.value })} rows={10} />
      </label>

      <label>
        <span>Notes</span>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={5} />
      </label>

      <div className="button-row">
        <button className="button button-primary" onClick={onSave}>Save recipe</button>
        <button className="button button-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function App() {
  const [recipes, setRecipes] = useState(() => {
    const saved = window.localStorage.getItem('recipe-box-data')
    return saved ? JSON.parse(saved) : demoRecipes
  })
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(1)
  const [importText, setImportText] = useState('')
  const [editing, setEditing] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [cookMode, setCookMode] = useState(false)
  const [keepAwake, setKeepAwake] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState({})
  const [draft, setDraft] = useState(null)
  const [ocrStatus, setOcrStatus] = useState('idle')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrError, setOcrError] = useState('')
  const [ocrImageName, setOcrImageName] = useState('')
  const [activeTag, setActiveTag] = useState('All')

  useWakeLock(cookMode && keepAwake)

  useEffect(() => {
    window.localStorage.setItem('recipe-box-data', JSON.stringify(recipes))
  }, [recipes])

  const allTags = useMemo(() => {
    const tags = new Set()
    recipes.forEach((recipe) => {
      ;(recipe.tags || []).forEach((tag) => tags.add(tag))
    })
    return ['All', ...Array.from(tags).sort((a, b) => a.localeCompare(b))]
  }, [recipes])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return recipes.filter((recipe) => {
      const matchesSearch =
        !q || [recipe.title, recipe.source, ...(recipe.tags || []), ...(recipe.ingredients || [])].join(' ').toLowerCase().includes(q)
      const matchesTag = activeTag === 'All' || (recipe.tags || []).includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [recipes, query, activeTag])

  const selected = filtered.find((recipe) => recipe.id === selectedId) || filtered[0] || null

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id)
    }
  }, [selected, selectedId])

  useEffect(() => {
    if (activeTag !== 'All' && !allTags.includes(activeTag)) {
      setActiveTag('All')
    }
  }, [activeTag, allTags])

  const openEditor = (recipe) => {
    setDraft({
      ...recipe,
      tagsText: (recipe.tags || []).join(', '),
      ingredientsText: joinForEdit(recipe.ingredients || []),
      stepsText: joinForEdit(recipe.steps || []),
    })
    setEditing(true)
  }

  const saveDraft = () => {
    if (!draft) return

    const normalised = {
      ...draft,
      tags: (draft.tagsText || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ingredients: splitFromEdit(draft.ingredientsText || ''),
      steps: splitFromEdit(draft.stepsText || ''),
    }

    if (normalised.id) {
      setRecipes((prev) => prev.map((recipe) => (recipe.id === normalised.id ? normalised : recipe)))
      setSelectedId(normalised.id)
    } else {
      const created = { ...normalised, id: Date.now() }
      setRecipes((prev) => [created, ...prev])
      setSelectedId(created.id)
    }

    setEditing(false)
    setDraft(null)
  }

  const importFromText = () => {
    const parsed = parseRecipeText(importText)
    if (!parsed) return

    setDraft({
      ...parsed,
      tagsText: parsed.tags.join(', '),
      ingredientsText: joinForEdit(parsed.ingredients),
      stepsText: joinForEdit(parsed.steps),
    })
    setShowImport(false)
    setImportText('')
    setOcrStatus('idle')
    setEditing(true)
  }

  const createBlank = () => {
    setDraft({
      title: '',
      source: 'Manual entry',
      tags: [],
      tagsText: '',
      pinned: false,
      servings: '',
      unitPreference: 'cups-spoons',
      ingredients: [],
      steps: [],
      ingredientsText: '',
      stepsText: '',
      notes: '',
      rawText: '',
    })
    setEditing(true)
  }

  const removeRecipe = (id) => {
    const next = recipes.filter((recipe) => recipe.id !== id)
    setRecipes(next)
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null)
    }
  }

  const togglePinned = (id) => {
    setRecipes((prev) => prev.map((recipe) => (recipe.id === id ? { ...recipe, pinned: !recipe.pinned } : recipe)))
  }

  const runOCR = async (file) => {
    if (!file) return

    setOcrStatus('reading')
    setOcrProgress(0)
    setOcrError('')
    setOcrImageName(file.name || 'screenshot')
    setShowImport(true)
    setImportText('')

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            setOcrProgress(Math.round(message.progress * 100))
          }
        },
      })

      const extracted = result?.data?.text?.trim() || ''
      if (!extracted) {
        setOcrStatus('error')
        setOcrError('No readable text was found in that image. Try a clearer screenshot, crop tighter around the recipe, or paste the text instead.')
        return
      }

      setImportText(extracted)
      setOcrStatus('done')
      setOcrProgress(100)
    } catch (error) {
      console.error(error)
      setOcrStatus('error')
      setOcrError('OCR could not read that screenshot in this browser session. You can still paste the recipe text, or try another image.')
    }
  }

  return (
    <div className="app-shell">
      <div className="page-wrap">
        <section className="hero-card">
          <div className="brand-row">
            <div className="brand-mark">
              <ChefHat size={24} />
            </div>
            <h1>Recipe Box</h1>
          </div>

          <div className="button-row wrap">
            <button className="button button-primary" onClick={() => setShowImport(true)}>
              <ClipboardPaste size={16} /> Import text
            </button>
            <label>
              <input type="file" accept="image/*" className="hidden-input" onChange={(e) => runOCR(e.target.files?.[0])} />
              <span className="button button-secondary">
                <Upload size={16} /> Screenshot
              </span>
            </label>
            <button className="button button-secondary" onClick={createBlank}>
              <Plus size={16} /> New recipe
            </button>
          </div>
        </section>

        <main className="content-grid">
          <aside className="panel-card sidebar-card">
            <div className="panel-head">
              <div className="panel-title-row">
                <h2>Recipe Box</h2>
                <span>{filtered.length}</span>
              </div>
              <div className="search-wrap">
                <Search size={16} className="search-icon" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, tag, ingredient" />
              </div>
              <div className="tag-row">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={`tag-button ${activeTag === tag ? 'active' : ''}`}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="recipe-list">
              {filtered.length ? (
                filtered.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedId(recipe.id)}
                    className={`recipe-list-item ${selected?.id === recipe.id ? 'selected' : ''}`}
                  >
                    <div className="recipe-list-title-row">
                      <h3>{recipe.title}</h3>
                      {recipe.pinned ? <Pin size={14} /> : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state">No recipes match this search or tag yet.</div>
              )}
            </div>
          </aside>

          <section className="panel-card detail-card">
            {selected ? (
              <>
                <div className="detail-head">
                  <div>
                    <h2 className={cookMode ? 'cook-title' : ''}>{selected.title}</h2>
                    {selected.servings ? <p className="muted-copy">Serves: {selected.servings}</p> : null}
                  </div>

                  <div className="button-row wrap">
                    <button className="button button-secondary" onClick={() => togglePinned(selected.id)}>
                      <Pin size={16} /> {selected.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button className="button button-secondary" onClick={() => openEditor(selected)}>
                      <Edit3 size={16} /> Edit
                    </button>
                    <button className="button button-secondary" onClick={() => setCookMode((value) => !value)}>
                      <BookOpen size={16} /> {cookMode ? 'Exit cook mode' : 'Cook mode'}
                    </button>
                    <button className="button button-secondary" onClick={() => removeRecipe(selected.id)}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>

                {cookMode ? (
                  <div className="cook-banner">
                    <div>
                      <p className="cook-banner-title">Cooking mode is on</p>
                      <p className="muted-copy">Large text, tick-off steps, and optional keep-screen-awake.</p>
                    </div>
                    <button className="button button-primary" onClick={() => setKeepAwake((value) => !value)}>
                      <MoonStar size={16} /> {keepAwake ? 'Screen staying awake' : 'Keep screen awake'}
                    </button>
                  </div>
                ) : null}

                <div className={`detail-grid ${cookMode ? 'single' : ''}`}>
                  <article className="sub-card">
                    <h3>Ingredients</h3>
                    <ul className={`ingredient-list ${cookMode ? 'large' : ''}`}>
                      {selected.ingredients.map((item, index) => (
                        <li key={index}>
                          <span className="dot" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="sub-card">
                    <h3>Method</h3>
                    <ol className="method-list">
                      {selected.steps.map((step, index) => {
                        const checked = checkedSteps[`${selected.id}-${index}`]
                        return (
                          <li key={index}>
                            <button
                              className="step-toggle"
                              onClick={() =>
                                setCheckedSteps((prev) => ({
                                  ...prev,
                                  [`${selected.id}-${index}`]: !checked,
                                }))
                              }
                            >
                              {checked ? <CheckSquare size={20} color={palette.accentDeep} /> : <Square size={20} color={palette.subtext} />}
                            </button>
                            <p className={`${cookMode ? 'large-step' : ''} ${checked ? 'done' : ''}`}>{step}</p>
                          </li>
                        )
                      })}
                    </ol>
                  </article>
                </div>

                {selected.notes ? (
                  <article className="sub-card notes-card">
                    <h3>Notes</h3>
                    <p>{selected.notes}</p>
                  </article>
                ) : null}
              </>
            ) : (
              <div className="empty-state">No recipe selected.</div>
            )}
          </section>
        </main>
      </div>

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import a recipe"
        description="Paste a recipe from a website, Instagram caption, or copied note. Screenshots can prefill this box after OCR."
      >
        <div className="form-grid">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="modal-textarea"
            placeholder={`Lemon loaf\nIngredients\n2 cups flour\n1 cup sugar\n...\n\nMethod\n1. Mix...`}
          />
          <div className="modal-footer">
            <div className="status-copy">
              {ocrStatus === 'reading' ? (
                <div className="progress-stack">
                  <p>Reading {ocrImageName || 'screenshot'}...</p>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${ocrProgress}%` }} />
                  </div>
                  <p>{ocrProgress}% complete</p>
                </div>
              ) : null}
              {ocrStatus === 'done' ? <p>Screenshot text loaded, ready to tidy.</p> : null}
              {ocrStatus === 'error' ? <p className="error-copy">{ocrError}</p> : null}
              {ocrStatus === 'idle' ? <p>You can still edit everything before saving.</p> : null}
            </div>
            <div className="button-row">
              <button className="button button-secondary" onClick={() => setShowImport(false)}>Cancel</button>
              <button className="button button-primary" onClick={importFromText} disabled={!importText.trim() || ocrStatus === 'reading'}>
                Parse and edit
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={draft?.id ? 'Edit recipe' : 'Create recipe'}
        description="Make changes before saving."
        maxWidth="960px"
      >
        {draft ? <RecipeForm draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={() => setEditing(false)} /> : null}
      </Modal>
    </div>
  )
}
