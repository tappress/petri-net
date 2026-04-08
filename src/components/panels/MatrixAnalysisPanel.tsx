import { useMemo } from 'react';
import { useMatrixAnalysisStore } from '@/store/matrixAnalysisStore';
import {
  matVecMul,
  vecAdd,
  vecEqual,
  isPositiveInv,
  isCompleteInv,
} from '@/engine/matrix';
import type { NetMatrices, FiringPath, SolveSteps, DisplayRat } from '@/engine/matrix';
import type { NetProperties } from '@/types/petri';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface ComputedAnalysis {
  matrices: NetMatrices;
  firingPath: FiringPath;
  tSteps: SolveSteps;
  pSteps: SolveSteps;
  tInvariants: number[][];
  pInvariants: number[][];
  treeProperties: NetProperties;
  treeHasCycle: boolean;
  cf: number[];
  muPrime: number[];
  matchesTree: boolean;
  sequential: boolean;
  invariant: boolean;
  conserves: boolean;
  hasCycle: boolean;
  bounded: boolean;
  uncoveredTransitions: string[];
  uncoveredPlaces: string[];
}

// ─── Display helpers ──────────────────────────────────────────────────────

function fmtCell(v: number): string {
  if (v === Infinity) return 'ω';
  if (v === -Infinity) return '-ω';
  return String(v);
}

function fmtVec(v: number[]): string {
  return '(' + v.map(fmtCell).join(', ') + ')';
}

/** Transpose an m×n matrix into n×m. */
function transpose(M: number[][]): number[][] {
  if (M.length === 0 || M[0].length === 0) return [];
  return M[0].map((_, j) => M.map(row => row[j]));
}

/** Format a fully-expanded dot product, e.g. "(-1)·2 + 1·1 + 0·1 + 0·0 = -1". */
function dotProductExpansion(coeffs: number[], values: number[]): string {
  if (coeffs.length === 0) return '0 = 0';
  const parts: string[] = [];
  let total = 0;
  for (let j = 0; j < coeffs.length; j++) {
    const c = coeffs[j];
    const v = values[j];
    total += c * v;
    const cStr = c < 0 ? `(${c})` : String(c);
    const vStr = v < 0 ? `(${v})` : String(v);
    parts.push(`${cStr}·${vStr}`);
  }
  return parts.join(' + ') + ' = ' + total;
}

/** Format a linear equation (skipping zero terms), e.g. "-x1 + x4 = 0". */
function formatLinearEq(coeffs: number[], varNames: string[]): string {
  const terms: string[] = [];
  for (let i = 0; i < coeffs.length; i++) {
    const c = coeffs[i];
    if (c === 0) continue;
    if (terms.length === 0) {
      if (c === 1) terms.push(varNames[i]);
      else if (c === -1) terms.push(`−${varNames[i]}`);
      else terms.push(`${c}·${varNames[i]}`);
    } else {
      const abs = Math.abs(c);
      const sign = c > 0 ? '+' : '−';
      if (abs === 1) terms.push(`${sign} ${varNames[i]}`);
      else terms.push(`${sign} ${abs}·${varNames[i]}`);
    }
  }
  if (terms.length === 0) return '0 = 0';
  return terms.join(' ') + ' = 0';
}

/** Format a rational as "p" or "p/q" (sign goes on the numerator). */
function fmtRatRaw(r: DisplayRat): string {
  if (r.d === 1) return String(r.n);
  return `${r.n}/${r.d}`;
}

/** Collapsible accordion using native <details>. */
function Details({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border border-border rounded mt-2 bg-white/40"
    >
      <summary className="cursor-pointer px-2 py-1 hover:bg-muted/60 select-none text-[11px] font-medium list-none flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground transition-transform group-open:rotate-90 inline-block w-2 text-center">
          ▸
        </span>
        <span>{title}</span>
      </summary>
      <div className="px-2.5 py-2 border-t border-border space-y-2">{children}</div>
    </details>
  );
}

/** Matrix with row & column labels (rows top→bottom, cols left→right). */
function MatrixTable({
  title,
  matrix,
  rowLabels,
  colLabels,
  cornerLabel,
  highlight,
}: {
  title?: string;
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
  cornerLabel?: string;
  highlight?: 'pos' | 'neg' | 'none';
}) {
  return (
    <div className="overflow-x-auto">
      {title && (
        <div className="text-[11px] font-semibold text-foreground mb-1">{title}</div>
      )}
      <table className="text-[11px] font-mono border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
              {cornerLabel ?? ''}
            </th>
            {colLabels.map((c, j) => (
              <th
                key={j}
                className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center min-w-[28px]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
                {rowLabels[i]}
              </th>
              {row.map((v, j) => {
                let cls = '';
                if (highlight === 'pos' && v > 0) cls = 'text-green-700';
                else if (highlight === 'pos' && v < 0) cls = 'text-red-600';
                return (
                  <td
                    key={j}
                    className={`border border-border px-1.5 py-0.5 text-center ${cls}`}
                  >
                    {fmtCell(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single-row vector with column labels above. */
function VectorTable({
  title,
  values,
  labels,
}: {
  title?: string;
  values: number[];
  labels: string[];
}) {
  return (
    <div className="overflow-x-auto">
      {title && (
        <div className="text-[11px] font-semibold text-foreground mb-1">{title}</div>
      )}
      <table className="text-[11px] font-mono border-collapse">
        <thead>
          <tr>
            {labels.map((l, i) => (
              <th
                key={i}
                className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center min-w-[28px]"
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {values.map((v, i) => (
              <td key={i} className="border border-border px-1.5 py-0.5 text-center">
                {fmtCell(v)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PropRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`shrink-0 font-bold text-sm ${ok ? 'text-green-600' : 'text-red-500'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium">{label}</span>
        {detail && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ─── Gauss elimination steps display ──────────────────────────────────────

function RatMatrixTable({
  matrix,
  colLabels,
  cornerLabel,
  pivotCols,
}: {
  matrix: DisplayRat[][];
  colLabels: string[];
  cornerLabel?: string;
  pivotCols?: Set<number>;
}) {
  if (matrix.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] font-mono border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
              {cornerLabel ?? ''}
            </th>
            {colLabels.map((c, j) => (
              <th
                key={j}
                className={`border border-border px-1.5 py-0.5 font-semibold text-center min-w-[28px] ${
                  pivotCols?.has(j)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
                R{i + 1}
              </th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`border border-border px-1.5 py-0.5 text-center ${
                    v.n !== 0 && pivotCols?.has(j) ? 'text-indigo-700 font-semibold' : ''
                  }`}
                >
                  {fmtRatRaw(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GaussSteps({
  steps,
  varNames,
  varKindLabel,
  unknownsLabel,
}: {
  steps: SolveSteps;
  varNames: string[];                  // e.g. ["x1", "x2", "x3", "x4"]
  varKindLabel: string;                // "T-інваріант" or "P-інваріант"
  unknownsLabel: string;               // human-readable note about what variables represent
}) {
  const pivotSet = new Set(steps.pivots);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        1) Зводимо систему до східчастого вигляду методом Гауса (RREF). Стовпці підсвічено
        синім — опорні (pivot), решта — вільні. Рядки з усіма нулями означають залежні рівняння
        і відкидаються.
      </p>

      {steps.rref.length > 0 ? (
        <RatMatrixTable
          matrix={steps.rref}
          colLabels={varNames}
          cornerLabel="RREF"
          pivotCols={pivotSet}
        />
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          Система порожня — будь-який вектор є розв'язком.
        </p>
      )}

      <div className="text-[11px] text-muted-foreground">
        Опорні (залежні) змінні:{' '}
        <strong className="text-indigo-700 font-mono">
          {steps.pivots.length === 0 ? '—' : steps.pivots.map(p => varNames[p]).join(', ')}
        </strong>
        {' · '}Вільні змінні:{' '}
        <strong className="text-foreground font-mono">
          {steps.free.length === 0 ? '—' : steps.free.map(f => varNames[f]).join(', ')}
        </strong>
      </div>
      <p className="text-[11px] text-muted-foreground">{unknownsLabel}</p>

      {/* Express each pivot in terms of free variables */}
      {steps.pivots.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">
            2) З RREF виражаємо опорні змінні через вільні:
          </p>
          <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
            {steps.pivots.map((pCol, i) => {
              const row = steps.rref[i];
              // pivot row: x[pCol] = -sum_{f in free} row[f] * x[f]
              const rhsTerms: string[] = [];
              for (const f of steps.free) {
                const c = row[f];
                if (c.n === 0) continue;
                const negC: DisplayRat = { n: -c.n, d: c.d };
                if (rhsTerms.length === 0) {
                  if (negC.n === negC.d) rhsTerms.push(varNames[f]);
                  else if (negC.n === -negC.d) rhsTerms.push(`−${varNames[f]}`);
                  else rhsTerms.push(`${fmtRatRaw(negC)}·${varNames[f]}`);
                } else {
                  const sign = negC.n > 0 ? '+' : '−';
                  const abs: DisplayRat = { n: Math.abs(negC.n), d: negC.d };
                  if (abs.n === abs.d) rhsTerms.push(`${sign} ${varNames[f]}`);
                  else rhsTerms.push(`${sign} ${fmtRatRaw(abs)}·${varNames[f]}`);
                }
              }
              return (
                <div key={i}>
                  {varNames[pCol]} = {rhsTerms.length === 0 ? '0' : rhsTerms.join(' ')}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Construct each basis vector */}
      {steps.cases.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">
            3) Для кожної вільної змінної будуємо базисний {varKindLabel}:
          </p>
          <div className="space-y-1.5">
            {steps.cases.map((c, k) => {
              // Build the rational solution display: each variable's value
              const valueLine = c.rationalVector.map(fmtRatRaw).join(', ');
              const intLine = c.intVector.join(', ');
              const needsScale = c.rationalVector.some(r => r.d !== 1);
              const scaleLabel = Math.abs(c.scale) > 1 ? ` × ${Math.abs(c.scale)}` : '';
              const flipLabel = c.scale < 0 ? ' (з нормалізацією знаку)' : '';
              return (
                <div
                  key={k}
                  className="text-[11px] font-mono bg-muted/30 rounded px-2 py-1.5 leading-relaxed"
                >
                  <div className="text-muted-foreground">
                    Випадок {k + 1}: {varNames[c.freeVar]} = 1
                    {steps.free.length > 1 &&
                      `, інші вільні (${steps.free
                        .filter(f => f !== c.freeVar)
                        .map(f => varNames[f])
                        .join(', ')}) = 0`}
                  </div>
                  <div>
                    Підстановка → ({valueLine})
                  </div>
                  {needsScale && (
                    <div className="text-muted-foreground">
                      Множимо на спільний знаменник{scaleLabel}
                      {flipLabel}:
                    </div>
                  )}
                  <div>
                    <strong>{varKindLabel} {k + 1}:</strong> ({intLine})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {steps.cases.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Вільних змінних немає — система має лише тривіальний нульовий розв'язок.
        </p>
      )}
    </div>
  );
}

// ─── Invariant table (basis vectors as rows) ──────────────────────────────

function InvariantsTable({
  basis,
  colLabels,
  rowPrefix,
}: {
  basis: number[][];
  colLabels: string[];
  rowPrefix: string;
}) {
  if (basis.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Базисні розв'язки відсутні (тривіальний нульовий розв'язок).
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] font-mono border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
              №
            </th>
            {colLabels.map((c, j) => (
              <th
                key={j}
                className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center min-w-[28px]"
              >
                {c}
              </th>
            ))}
            <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
              позитивний
            </th>
            <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
              повний
            </th>
          </tr>
        </thead>
        <tbody>
          {basis.map((vec, i) => {
            const pos = isPositiveInv(vec);
            const full = isCompleteInv(vec);
            return (
              <tr key={i}>
                <th className="border border-border px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-semibold text-center">
                  {rowPrefix}
                  {i + 1}
                </th>
                {vec.map((v, j) => (
                  <td
                    key={j}
                    className={`border border-border px-1.5 py-0.5 text-center ${
                      v < 0 ? 'text-red-600' : v > 0 ? 'text-green-700' : 'text-muted-foreground'
                    }`}
                  >
                    {v}
                  </td>
                ))}
                <td className="border border-border px-1.5 py-0.5 text-center">
                  {pos ? '✓' : '✗'}
                </td>
                <td className="border border-border px-1.5 py-0.5 text-center">
                  {full ? '✓' : '✗'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────

export default function MatrixAnalysisPanel() {
  const { isVisible, result, isComputing, hide } = useMatrixAnalysisStore();

  const computed = useMemo<ComputedAnalysis | null>(() => {
    if (!result) return null;
    const { matrices, firingPath, tSteps, pSteps, tree, treeProperties } = result;
    const tInvariants = tSteps.basis;
    const pInvariants = pSteps.basis;

    // Tree has a structural cycle iff some marking is revisited (duplicate node).
    const treeHasCycle = Object.values(tree.nodes).some(n => n.nodeType === 'duplicate');

    // μ' = μ + C·f(σ)
    const cf = matVecMul(matrices.C, firingPath.firingVector);
    const muPrime = vecAdd(firingPath.startMarking, cf);
    const matchesTree = vecEqual(muPrime, firingPath.endMarking);

    // Property analysis
    const transitionsCount = matrices.transitionIds.length;
    const placesCount = matrices.placeIds.length;

    // Sequential: every transition is in some positive T-invariant
    const transitionCovered = new Array(transitionsCount).fill(false);
    let sequential = transitionsCount > 0;
    for (const inv of tInvariants) {
      if (!isPositiveInv(inv)) continue;
      for (let j = 0; j < transitionsCount; j++) {
        if (inv[j] > 0) transitionCovered[j] = true;
      }
    }
    if (transitionCovered.some(c => !c)) sequential = false;

    // Invariant: every place is in some positive P-invariant
    const placeCovered = new Array(placesCount).fill(false);
    let invariant = placesCount > 0;
    for (const inv of pInvariants) {
      if (!isPositiveInv(inv)) continue;
      for (let i = 0; i < placesCount; i++) {
        if (inv[i] > 0) placeCovered[i] = true;
      }
    }
    if (placeCovered.some(c => !c)) invariant = false;

    const hasPositiveT = tInvariants.some(isPositiveInv);
    const hasPositiveP = pInvariants.some(isPositiveInv);
    const conserves = hasPositiveP;
    const hasCycle = hasPositiveT;
    const bounded = hasPositiveP && pInvariants.some(inv => isPositiveInv(inv) && isCompleteInv(inv));

    return {
      matrices,
      firingPath,
      tSteps,
      pSteps,
      tInvariants,
      pInvariants,
      treeProperties,
      treeHasCycle,
      cf,
      muPrime,
      matchesTree,
      sequential,
      invariant,
      conserves,
      hasCycle,
      bounded,
      uncoveredTransitions: transitionCovered
        .map((c, j) => (c ? null : matrices.transitionLabels[matrices.transitionIds[j]]))
        .filter(Boolean) as string[],
      uncoveredPlaces: placeCovered
        .map((c, i) => (c ? null : matrices.placeLabels[matrices.placeIds[i]]))
        .filter(Boolean) as string[],
    };
  }, [result]);

  if (!isVisible) return null;

  return (
    <div className="flex flex-col bg-card border-l border-border w-1/2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Матричний аналіз</span>
        <button
          onClick={hide}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>

      {isComputing ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Обчислення…
        </div>
      ) : !computed ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
          Натисніть <strong className="mx-1">Матриці</strong> на панелі інструментів, щоб
          побудувати матричне подання мережі.
        </div>
      ) : (
        <MatrixContent computed={computed} />
      )}
    </div>
  );
}

// ─── Content (split out so hook order is stable) ──────────────────────────

function MatrixContent({ computed }: { computed: ComputedAnalysis }) {
  const {
    matrices,
    firingPath,
    tSteps,
    pSteps,
    tInvariants,
    pInvariants,
    treeProperties,
    treeHasCycle,
    cf,
    muPrime,
    matchesTree,
    sequential,
    invariant,
    conserves,
    hasCycle,
    bounded,
    uncoveredTransitions,
    uncoveredPlaces,
  } = computed;

  const placeCols = matrices.placeIds.map(p => matrices.placeLabels[p]);
  const transCols = matrices.transitionIds.map(t => matrices.transitionLabels[t]);

  // Conclusion lines
  const conclusion: string[] = [];
  if (hasCycle) conclusion.push('У мережі є цикли (існує позитивний T-інваріант).');
  else conclusion.push('Циклічність відсутня — позитивних T-інваріантів не знайдено.');
  if (sequential) conclusion.push('Мережа послідовна: кожен перехід входить хоча б до одного позитивного T-інваріанта.');
  else if (uncoveredTransitions.length > 0)
    conclusion.push(`Мережа НЕ послідовна — переходи без T-інваріантів: ${uncoveredTransitions.join(', ')}.`);
  if (invariant) conclusion.push('Мережа інваріантна: кожна позиція покрита позитивним P-інваріантом.');
  else if (uncoveredPlaces.length > 0)
    conclusion.push(`Мережа НЕ інваріантна — позиції без P-інваріантів: ${uncoveredPlaces.join(', ')}.`);
  if (conserves) conclusion.push('Ресурси зберігаються — існує позитивний P-інваріант.');
  else conclusion.push('Збереження ресурсів НЕ гарантоване — позитивний P-інваріант відсутній.');
  if (bounded) conclusion.push('Обмеженість мережі гарантована повним позитивним P-інваріантом.');
  else conclusion.push('Обмеженість не гарантована з матричного аналізу.');

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="p-3 space-y-4">
        <div className="text-[11px] text-muted-foreground leading-snug">
          Лабораторна робота 3 — дослідження мережі Петрі на основі матричних методів.
          Враховуються лише звичайні дуги (normal); інгібіторні, читальні та скидальні дуги
          ігноруються.
        </div>

        {/* ── Step 2: Матриця передумов F ──────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 2.1 — Матриця передумов F
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            F(p<sub>i</sub>, t<sub>j</sub>) — описує вхідні дуги мережі (від позицій до переходів).
          </p>
          <MatrixTable
            matrix={matrices.F}
            rowLabels={placeCols}
            colLabels={transCols}
            cornerLabel="F"
          />
        </section>

        <Separator />

        {/* ── Step 2: Матриця наслідків H ──────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 2.2 — Матриця наслідків H
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            H(t<sub>j</sub>, p<sub>i</sub>) — описує вихідні дуги мережі (від переходів до позицій).
          </p>
          <MatrixTable
            matrix={matrices.H}
            rowLabels={transCols}
            colLabels={placeCols}
            cornerLabel="H"
          />
        </section>

        <Separator />

        {/* ── Step 2: Матриця інцидентності C ──────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 2.3 — Матриця інцидентності C = H<sup>T</sup> − F
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            C показує сумарну зміну розмітки при спрацюванні кожного переходу.
          </p>
          <MatrixTable
            matrix={matrices.C}
            rowLabels={placeCols}
            colLabels={transCols}
            cornerLabel="C"
            highlight="pos"
          />

          <Details title="Покрокове обчислення C = Hᵀ − F">
            <p className="text-[11px] text-muted-foreground">
              1) Транспонуємо матрицю наслідків H, щоб отримати H<sup>T</sup> з рядками-позиціями
              та стовпцями-переходами:
            </p>
            <MatrixTable
              matrix={transpose(matrices.H)}
              rowLabels={placeCols}
              colLabels={transCols}
              cornerLabel="Hᵀ"
            />
            <p className="text-[11px] text-muted-foreground">
              2) Поелементно віднімаємо матрицю передумов:
              <span className="font-mono">
                {' '}
                C[i][j] = H<sup>T</sup>[i][j] − F[i][j]
              </span>
              .
            </p>
            <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5">
              {matrices.placeIds.map((p, i) => (
                <div key={p}>
                  {matrices.transitionIds.map((t, j) => {
                    const ht = transpose(matrices.H)[i][j];
                    const f = matrices.F[i][j];
                    const c = matrices.C[i][j];
                    if (ht === 0 && f === 0) return null;
                    return (
                      <span key={t} className="inline-block mr-3">
                        C[{matrices.placeLabels[p]},{matrices.transitionLabels[t]}] = {ht} − {f} ={' '}
                        <strong>{c}</strong>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Details>
        </section>

        <Separator />

        {/* ── Step 3: Початкова розмітка μ₀ ────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 3 — Початкова розмітка μ₀
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Вектор кількості фішок у позиціях у початковому стані системи.
          </p>
          <VectorTable values={matrices.initialMarking} labels={placeCols} />
          <div className="text-[11px] font-mono mt-1.5">
            μ₀ = {fmtVec(matrices.initialMarking)}
          </div>
        </section>

        <Separator />

        {/* ── Step 4: Аналіз зміни розмітки ────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 4 — Аналіз зміни розмітки: μ' = μ + C·f(σ)
          </h3>

          {firingPath.firedLabels.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              Дерево покриваючих маркувань не містить шляху з переходами — переходи не спрацьовують.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Обрано шлях з дерева покриваючих маркувань довжиною {firingPath.firedLabels.length}{' '}
                {firingPath.firedLabels.length === 1 ? 'перехід' : 'переходів'}:
              </p>
              <div className="text-[11px] font-mono bg-muted/40 rounded px-2 py-1.5 leading-snug">
                {firingPath.firedLabels.join(' → ')}
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Вектор спрацювання переходів f(σ):
                </div>
                <VectorTable values={firingPath.firingVector} labels={transCols} />
                <div className="text-[11px] font-mono mt-1">
                  f(σ) = {fmtVec(firingPath.firingVector)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Обчислюємо C·f(σ):
                </div>
                <VectorTable values={cf} labels={placeCols} />
                <div className="text-[11px] font-mono mt-1">C·f(σ) = {fmtVec(cf)}</div>

                <Details title="Покрокове обчислення C·f(σ)">
                  <p className="text-[11px] text-muted-foreground">
                    Скалярний добуток кожного рядка C на вектор f(σ):
                  </p>
                  <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
                    {matrices.placeIds.map((p, i) => (
                      <div key={p}>
                        (C·f(σ))[{matrices.placeLabels[p]}] ={' '}
                        {dotProductExpansion(matrices.C[i], firingPath.firingVector)}
                      </div>
                    ))}
                  </div>
                </Details>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Нова розмітка μ' = μ + C·f(σ):
                </div>
                <VectorTable values={muPrime} labels={placeCols} />
                <div className="text-[11px] font-mono mt-1">μ' = {fmtVec(muPrime)}</div>

                <Details title="Покрокове обчислення μ' = μ + C·f(σ)">
                  <p className="text-[11px] text-muted-foreground">
                    Поелементне додавання вектора початкового маркування μ та C·f(σ):
                  </p>
                  <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
                    {matrices.placeIds.map((p, i) => {
                      const m = firingPath.startMarking[i];
                      const cfi = cf[i];
                      const mp = muPrime[i];
                      const mStr = m === Infinity ? 'ω' : String(m);
                      const cfiStr = cfi === Infinity ? 'ω' : cfi < 0 ? `(${cfi})` : String(cfi);
                      const mpStr = mp === Infinity ? 'ω' : String(mp);
                      return (
                        <div key={p}>
                          μ'[{matrices.placeLabels[p]}] = {mStr} + {cfiStr} ={' '}
                          <strong>{mpStr}</strong>
                        </div>
                      );
                    })}
                  </div>
                </Details>
              </div>

              <div
                className={`text-[11px] rounded px-2 py-1.5 leading-snug ${
                  matchesTree
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                {matchesTree
                  ? `Перевірка: μ' збігається з маркуванням у дереві покриваючих маркувань ${fmtVec(
                      firingPath.endMarking,
                    )}. Дерево покриваючих маркувань та матриця інцидентності побудовані правильно.`
                  : `Увага: обчислена розмітка μ' = ${fmtVec(
                      muPrime,
                    )} відрізняється від маркування у дереві ${fmtVec(
                      firingPath.endMarking,
                    )}. Це може бути спричинено наявністю спеціальних дуг або ω-маркувань (псевдомаркувань).`}
              </div>
            </div>
          )}
        </section>

        <Separator />

        {/* ── Step 5: T-інваріанти ─────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 5 — T-інваріанти (C · x = 0)
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Базисні розв'язки системи C·x = 0. T-інваріант — вектор спрацювань переходів,
            що повертає мережу у вихідний стан.
          </p>
          <InvariantsTable
            basis={tInvariants}
            colLabels={transCols.map((_, i) => `x${i + 1}`)}
            rowPrefix="x"
          />
          <div className="text-[11px] text-muted-foreground mt-1.5">
            Знайдено базисних T-інваріантів: <strong>{tInvariants.length}</strong>
            {' · '}з них позитивних:{' '}
            <strong>{tInvariants.filter(isPositiveInv).length}</strong>
            {' · '}повних:{' '}
            <strong>{tInvariants.filter(isCompleteInv).length}</strong>
          </div>

          <Details title="Покрокове розв'язання системи C·x = 0">
            <p className="text-[11px] text-muted-foreground">
              Кожен рядок матриці C породжує одне рівняння системи (невідомі{' '}
              {transCols.map((_, i) => `x${i + 1}`).join(', ')} — кількості спрацювань переходів{' '}
              {transCols.join(', ')}):
            </p>
            <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
              {matrices.C.map((row, i) => {
                const xVars = transCols.map((_, k) => `x${k + 1}`);
                const allZero = row.every(c => c === 0);
                return (
                  <div key={i}>
                    <span className="text-muted-foreground mr-1">
                      ({matrices.placeLabels[matrices.placeIds[i]]})
                    </span>
                    {allZero ? '0 = 0  (тривіально)' : formatLinearEq(row, xVars)}
                  </div>
                );
              })}
            </div>

            <GaussSteps
              steps={tSteps}
              varNames={transCols.map((_, i) => `x${i + 1}`)}
              varKindLabel="T-інваріант"
              unknownsLabel={`Тут x_i ≥ 0 — кількість спрацювань переходу ${transCols.join(
                ', ',
              )} відповідно. T-інваріант — такий вектор спрацювань, після якого мережа повертається до початкової розмітки.`}
            />
          </Details>
        </section>

        <Separator />

        {/* ── Step 6: P-інваріанти ─────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 6 — P-інваріанти (y · C = 0)
          </h3>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Базисні розв'язки системи y·C = 0. P-інваріант — ваговий вектор позицій, для якого
            y·μ зберігається при кожному спрацюванні переходу.
          </p>
          <InvariantsTable
            basis={pInvariants}
            colLabels={placeCols.map((_, i) => `y${i + 1}`)}
            rowPrefix="y"
          />
          <div className="text-[11px] text-muted-foreground mt-1.5">
            Знайдено базисних P-інваріантів: <strong>{pInvariants.length}</strong>
            {' · '}з них позитивних:{' '}
            <strong>{pInvariants.filter(isPositiveInv).length}</strong>
            {' · '}повних:{' '}
            <strong>{pInvariants.filter(isCompleteInv).length}</strong>
          </div>

          <Details title="Покрокове розв'язання системи y·C = 0">
            <p className="text-[11px] text-muted-foreground">
              Кожен стовпець матриці C породжує одне рівняння системи (невідомі{' '}
              {placeCols.map((_, i) => `y${i + 1}`).join(', ')} — ваги позицій {placeCols.join(', ')}):
            </p>
            <div className="text-[11px] font-mono space-y-0.5 bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
              {matrices.transitionIds.map((t, j) => {
                const col = matrices.C.map(row => row[j]);
                const yVars = placeCols.map((_, k) => `y${k + 1}`);
                const allZero = col.every(c => c === 0);
                return (
                  <div key={t}>
                    <span className="text-muted-foreground mr-1">
                      ({matrices.transitionLabels[t]})
                    </span>
                    {allZero ? '0 = 0  (тривіально)' : formatLinearEq(col, yVars)}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Систему y·C = 0 розв'язуємо як C<sup>T</sup>·y = 0 — застосовуємо метод Гауса до
              транспонованої матриці.
            </p>

            <GaussSteps
              steps={pSteps}
              varNames={placeCols.map((_, i) => `y${i + 1}`)}
              varKindLabel="P-інваріант"
              unknownsLabel={`Тут y_i — ваги позицій ${placeCols.join(
                ', ',
              )} відповідно. P-інваріант — такий ваговий вектор, для якого зважена сума фішок y·μ зберігається при кожному спрацюванні переходу.`}
            />
          </Details>
        </section>

        <Separator />

        {/* ── Step 7-8: Властивості мережі ─────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Кроки 7–8 — Властивості мережі
          </h3>
          <div className="divide-y divide-border">
            <PropRow
              label="Інваріантність"
              ok={invariant}
              detail={
                invariant
                  ? 'Кожна позиція покрита позитивним P-інваріантом — усі ресурси системи перебувають у балансі.'
                  : uncoveredPlaces.length > 0
                    ? `Позиції без позитивного P-інваріанта: ${uncoveredPlaces.join(', ')}.`
                    : 'Позитивних P-інваріантів немає.'
              }
            />
            <PropRow
              label="Послідовність"
              ok={sequential}
              detail={
                sequential
                  ? 'Кожен перехід належить принаймні до одного позитивного T-інваріанта — кожна подія є частиною циклічного процесу.'
                  : uncoveredTransitions.length > 0
                    ? `Переходи без позитивного T-інваріанта: ${uncoveredTransitions.join(', ')}.`
                    : 'Позитивних T-інваріантів немає.'
              }
            />
            <PropRow
              label="Наявність циклів"
              ok={hasCycle}
              detail={
                hasCycle
                  ? 'Існує позитивний T-інваріант — у мережі є цикл, який повертає її у вихідний стан.'
                  : 'Позитивних T-інваріантів немає — циклічна поведінка не виявлена.'
              }
            />
            <PropRow
              label="Збереження ресурсів"
              ok={conserves}
              detail={
                conserves
                  ? 'Існує позитивний P-інваріант — ресурси у мережі зберігаються.'
                  : 'Усі P-інваріанти містять від\u02BCємні значення або відсутні — фізичне збереження ресурсу не гарантоване.'
              }
            />
            <PropRow
              label="Обмеженість (з матриць)"
              ok={bounded}
              detail={
                bounded
                  ? 'Існує повний позитивний P-інваріант — кожна позиція обмежена.'
                  : 'Повного позитивного P-інваріанта не знайдено — обмеженість не гарантована (може бути перевірена через дерево покриваючих маркувань).'
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              позитивних T: {tInvariants.filter(isPositiveInv).length}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              повних T: {tInvariants.filter(isCompleteInv).length}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              позитивних P: {pInvariants.filter(isPositiveInv).length}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              повних P: {pInvariants.filter(isCompleteInv).length}
            </Badge>
          </div>
        </section>

        <Separator />

        {/* ── Step 9: Висновок ─────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Крок 9 — Висновок
          </h3>
          <ul className="list-disc list-inside text-[11px] leading-relaxed space-y-1">
            {conclusion.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <Separator />

        {/* ── Step 10: Порівняння з аналізом дерева ────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Крок 10 — Порівняння з деревом покриваючих маркувань
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            Зіставлення результатів матричного аналізу з аналізом дерева покриваючих маркувань
            (Лабораторна 2). Матричний аналіз — <strong>структурний</strong>: питає «чи існує
            такий вектор/закон у мережі?», не залежить від початкового маркування. Дерево —{' '}
            <strong>поведінковий</strong>: питає «що насправді відбувається з μ₀?». Тому
            обидва методи можуть давати різні (але не суперечливі) результати — натисніть
            «Чому такий результат?» під рядком, щоб побачити пояснення.
          </p>
          <ComparisonTable
            rows={buildComparisonRows({
              matrix: { conserves, bounded, hasCycle, sequential, invariant },
              tree: treeProperties,
              treeHasCycle,
              matrices,
              pInvariants,
              tInvariants,
              uncoveredTransitions,
            })}
          />
        </section>
      </div>
    </div>
  );
}

// ─── Step 10: comparison logic ─────────────────────────────────────────────

interface ComparisonRow {
  label: string;
  matrixOk: boolean;
  treeOk: boolean;
  status: 'confirmed' | 'consistent' | 'matrix-weaker' | 'tree-weaker' | 'contradiction';
  note: string;
  detail?: React.ReactNode;
}

interface ComparisonContext {
  matrix: {
    conserves: boolean;
    bounded: boolean;
    hasCycle: boolean;
    sequential: boolean;
    invariant: boolean;
  };
  tree: NetProperties;
  treeHasCycle: boolean;
  matrices: NetMatrices;
  pInvariants: number[][];
  tInvariants: number[][];
  uncoveredTransitions: string[];
}

function findFirstPositive(basis: number[][]): number[] | null {
  return basis.find(isPositiveInv) ?? null;
}

function buildComparisonRows(ctx: ComparisonContext): ComparisonRow[] {
  const { matrix, tree } = ctx;
  const rows: ComparisonRow[] = [];

  // 1) Збереження ресурсів
  // Tree: conservative (sum-in == sum-out per transition)  ⇒ all-ones P-invariant exists.
  // Matrix: positive P-inv exists (weaker condition).
  const conservesRow = classify(
    'Збереження ресурсів',
    matrix.conserves,
    tree.conservative,
    {
      confirmed: 'Обидва методи підтверджують збереження ресурсів.',
      consistent: 'Обидва методи не підтверджують збереження ресурсів.',
      matrixStronger:
        'Матриця знаходить позитивний P-інваріант, а в дереві деякі переходи змінюють сумарну кількість фішок — це нетривіальний закон збереження (вагова сума, не проста сума).',
      treeStronger:
        'СУПЕРЕЧНІСТЬ: дерево показує консервативність (сума зберігається), але матриця не знайшла жодного позитивного P-інваріанта. Перевірте побудову матриць або дерева покриваючих маркувань.',
    },
  );
  conservesRow.detail = renderConservesDetail(conservesRow.status, ctx);
  rows.push(conservesRow);

  // 2) Обмеженість
  // Matrix bounded (complete positive P-inv) ⇒ tree must be bounded.
  // Tree bounded does NOT require matrix to find such an invariant.
  const boundedRow = classify(
    'Обмеженість',
    matrix.bounded,
    tree.bounded,
    {
      confirmed: 'Обидва методи підтверджують обмеженість мережі.',
      consistent:
        'Обидва методи не гарантують обмеженість — у дереві знайдено ω, матриця не знайшла повного позитивного P-інваріанта.',
      matrixStronger:
        'СУПЕРЕЧНІСТЬ: матриця знайшла повний позитивний P-інваріант (необхідна обмеженість), але в дереві присутні ω-маркування (псевдомаркування). Перевірте коректність побудови.',
      treeStronger:
        'Дерево показує обмеженість, проте матричний аналіз не знайшов повного позитивного P-інваріанта. Це не суперечність — матричний критерій є достатнім, але не необхідним.',
    },
  );
  boundedRow.detail = renderBoundedDetail(boundedRow.status);
  rows.push(boundedRow);

  // 3a) Наявність циклів
  // Matrix: positive T-invariant exists.
  // Tree: at least one duplicate node (some marking revisited along a firing sequence).
  const cyclesRow = classify(
    'Наявність циклів',
    matrix.hasCycle,
    ctx.treeHasCycle,
    {
      confirmed:
        'Матриця знаходить позитивний T-інваріант; дерево має дублікат — деяка розмітка повторюється вздовж шляху. Циклічна поведінка існує.',
      consistent:
        'Циклів не виявлено: матриця не знайшла позитивного T-інваріанта, у дереві немає повторюваних маркувань.',
      matrixStronger:
        'Матриця виявила структурний цикл (позитивний T-інваріант), але в дереві жодне маркування не повторюється — цикл існує структурно, проте не активується з μ₀.',
      treeStronger:
        'СУПЕРЕЧНІСТЬ: у дереві є повторювані маркування, але матриця не знайшла позитивного T-інваріанта. Перевірте побудову.',
    },
  );
  cyclesRow.detail = renderCyclesDetail(cyclesRow.status, ctx);
  rows.push(cyclesRow);

  // 3b) Живість
  // Matrix: necessary structural conditions (sequential ⇒ every transition in some positive
  // T-inv) — necessary but not sufficient for behavioral liveness.
  // Tree: direct liveness check (no deadlocks AND no dead transitions).
  const livenessRow = classify(
    'Живість',
    matrix.sequential,
    tree.live,
    {
      confirmed:
        'Усі необхідні структурні умови виконані (кожен перехід у позитивному T-інваріанті) і поведінково мережа жива — немає тупиків і мертвих переходів.',
      consistent:
        'Живість не виявлена жодним методом: матриця показує, що структурні умови не виконані, дерево — що мережа фактично не жива.',
      matrixStronger:
        'Матриця показує, що необхідні структурні умови живості виконуються, але дерево виявило фактичний тупик або мертвий перехід. Структурно мережа могла би бути живою, проте з μ₀ існує шлях, який її «руйнує».',
      treeStronger:
        'СУПЕРЕЧНІСТЬ: дерево показує живість, але матриця знайшла переходи поза будь-яким позитивним T-інваріантом. У живій (бодай обмеженій) мережі цього не може бути — перевірте побудову.',
    },
  );
  livenessRow.detail = renderLivenessDetail(livenessRow.status, ctx);
  rows.push(livenessRow);

  // 4) Послідовність / потенційна живість
  // Matrix sequential: every transition is in some positive T-invariant.
  // Tree potentiallyLive: every transition fires at least once in the tree.
  const sequentialRow = classify(
    'Послідовність переходів',
    matrix.sequential,
    tree.potentiallyLive,
    {
      confirmed:
        'Кожен перехід структурно входить до циклу і фактично спрацьовує у дереві покриваючих маркувань — мережа потенційно жива.',
      consistent:
        'Існують переходи, які або не входять до жодного T-інваріанта, або не спрацьовують у дереві.',
      matrixStronger:
        'СУПЕРЕЧНІСТЬ: матриця стверджує, що кожен перехід належить до циклу, але деякі переходи — мертві у дереві. Це означає, що цикл не активується з μ₀.',
      treeStronger:
        'У дереві кожен перехід спрацьовує хоча б раз (мережа потенційно жива), проте матриця не для всіх знаходить T-інваріант. Деякі переходи беруть участь у виконанні, але не у структурних циклах.',
    },
  );
  sequentialRow.detail = renderSequentialDetail(sequentialRow.status, ctx);
  rows.push(sequentialRow);

  return rows;
}

// ─── Step 10: row detail renderers ────────────────────────────────────────

function renderConservesDetail(
  status: ComparisonRow['status'],
  ctx: ComparisonContext,
): React.ReactNode {
  if (status !== 'tree-weaker') return undefined;
  const inv = findFirstPositive(ctx.pInvariants);
  if (!inv) return undefined;
  const { matrices } = ctx;
  const placeLabels = matrices.placeIds.map(p => matrices.placeLabels[p]);

  // Build "y[1]·m(P1) + y[2]·m(P2) + ..." formula (skipping zero weights).
  const formulaParts: string[] = [];
  for (let i = 0; i < inv.length; i++) {
    if (inv[i] === 0) continue;
    const w = inv[i];
    const term = w === 1 ? `m(${placeLabels[i]})` : `${w}·m(${placeLabels[i]})`;
    formulaParts.push(formulaParts.length === 0 ? term : `+ ${term}`);
  }

  // Initial verification: y · μ₀.
  const initSum = inv.reduce((s, w, i) => s + w * matrices.initialMarking[i], 0);
  const initParts = inv
    .map((w, i) => `${w}·${matrices.initialMarking[i]}`)
    .join(' + ');

  return (
    <div className="space-y-1.5">
      <p>
        Дерево перевіряє, чи зберігається <strong>проста</strong> сума фішок Σm(p) при
        кожному спрацюванні переходу. Якщо хоч один перехід створює або поглинає фішки
        (рядок матриці C має ненульову суму), простої консервативності немає — саме це
        бачить дерево.
      </p>
      <p>
        Натомість матриця знайшла нетривіальний <strong>ваговий</strong> закон збереження.
        Базисний позитивний P-інваріант:
      </p>
      <div className="font-mono bg-muted/40 rounded px-2 py-1">
        y = ({inv.join(', ')}) над позиціями ({placeLabels.join(', ')})
      </div>
      <p>Зберігається така зважена сума фішок:</p>
      <div className="font-mono bg-muted/40 rounded px-2 py-1">
        {formulaParts.length > 0 ? formulaParts.join(' ') : '0'} = const
      </div>
      <p>
        Перевірка на початковій розмітці μ₀ = {fmtVec(matrices.initialMarking)}:{' '}
        <span className="font-mono">{initParts} = {initSum}</span>. Це значення зберігається
        при будь-якому спрацюванні переходу — отже, мережа консервативна <em>під цією вагою</em>,
        хоча проста сума і не зберігається. Обидва результати правильні: тривіального
        збереження немає, але нетривіальне є.
      </p>
    </div>
  );
}

function renderCyclesDetail(
  status: ComparisonRow['status'],
  ctx: ComparisonContext,
): React.ReactNode {
  if (status !== 'tree-weaker') return undefined;
  const inv = findFirstPositive(ctx.tInvariants);
  if (!inv) return undefined;
  const { matrices } = ctx;
  const transLabels = matrices.transitionIds.map(t => matrices.transitionLabels[t]);

  // Build "T1 + T3 + T4" or "2·T1 + T3" interpretation of the firing vector.
  const fireParts: string[] = [];
  for (let j = 0; j < inv.length; j++) {
    if (inv[j] === 0) continue;
    fireParts.push(inv[j] === 1 ? transLabels[j] : `${inv[j]}·${transLabels[j]}`);
  }

  return (
    <div className="space-y-1.5">
      <p>Матриця знайшла позитивний T-інваріант:</p>
      <div className="font-mono bg-muted/40 rounded px-2 py-1">
        x = ({inv.join(', ')}) над переходами ({transLabels.join(', ')})
      </div>
      <p>
        Це означає, що послідовність спрацювань{' '}
        <span className="font-mono">{fireParts.join(' + ')}</span> повертає мережу до тієї ж
        розмітки: μ + C·x = μ. Структурно <strong>цикл існує</strong>.
      </p>
      <p>
        Проте у дереві покриваючих маркувань жодне маркування не повторюється з μ₀ — отже,
        цей цикл недосяжний з початкового стану. Структура містить замкнений шлях, але
        потрапити у нього з μ₀ неможливо. Це не суперечність: матриця бачить структуру,
        дерево — поведінку від μ₀.
      </p>
    </div>
  );
}

function renderLivenessDetail(
  status: ComparisonRow['status'],
  ctx: ComparisonContext,
): React.ReactNode {
  if (status === 'tree-weaker') {
    // Matrix says necessary conditions met, tree says actually not live.
    // This is the most informative case — explain that matrix only checks necessary,
    // not sufficient, conditions.
    return (
      <div className="space-y-1.5">
        <p>
          Матричний аналіз перевіряє лише <strong>необхідну</strong> умову живості: кожен
          перехід має належати хоч до одного позитивного T-інваріанта (інакше він не може
          спрацьовувати нескінченно довго у жодному виконанні). Тут ця умова виконана.
        </p>
        <p>
          Проте ця умова <strong>не є достатньою</strong>: навіть якщо кожен перехід
          структурно бере участь у циклі, з μ₀ може існувати шлях у тупикову вершину
          (deadlock) або до маркування, у якому деякий перехід стає мертвим. Дерево
          покриваючих маркувань це безпосередньо виявило.
        </p>
        <p>
          Обидва результати правильні: матриця каже «структурно нічого не суперечить
          живості», дерево каже «фактично є тупик». Матриця не може передбачити вибір у
          конфлікті — це робить лише поведінковий аналіз.
        </p>
      </div>
    );
  }

  if (status === 'consistent') {
    // Both ✗ — matrix found uncovered transitions, tree found deadlocks/dead transitions.
    const uncovered = ctx.uncoveredTransitions;
    if (uncovered.length === 0) return undefined;
    return (
      <div className="space-y-1.5">
        <p>
          Обидва методи виявили відсутність живості, але з різних боків:
        </p>
        <p>
          • <strong>Матриця</strong> показує, що структурно неможливо досягти повної
          живості — переходи{' '}
          <strong className="font-mono">{uncovered.join(', ')}</strong> не входять до
          жодного позитивного T-інваріанта, отже не беруть участі в жодному циклі. Їхнє
          спрацювання назавжди змінює стан системи.
        </p>
        <p>
          • <strong>Дерево</strong> підтверджує це поведінково: у дереві покриваючих
          маркувань є тупикові вершини або мертві переходи з μ₀. Необхідна умова не
          виконана — необхідна умова відсутності тупиків теж.
        </p>
        <p>
          Це узгоджені, але <em>взаємно підсилюючі</em> результати — вони пояснюють одне
          й те саме явище з двох сторін.
        </p>
      </div>
    );
  }

  return undefined;
}

function renderSequentialDetail(
  status: ComparisonRow['status'],
  ctx: ComparisonContext,
): React.ReactNode {
  if (status !== 'matrix-weaker') return undefined;
  const uncovered = ctx.uncoveredTransitions;
  if (uncovered.length === 0) return undefined;

  return (
    <div className="space-y-1.5">
      <p>
        Дерево показує, що мережа <strong>потенційно жива</strong> — кожен перехід спрацьовує
        хоча б раз у дереві покриваючих маркувань.
      </p>
      <p>
        Проте матриця не знайшла жодного позитивного T-інваріанта, до якого входили б
        переходи: <strong className="font-mono">{uncovered.join(', ')}</strong>{' '}
        (їхні компоненти у всіх T-інваріантах дорівнюють 0).
      </p>
      <p>
        Це означає таке: ці переходи <em>можуть</em> спрацювати, але їхнє спрацювання{' '}
        <strong>не повертає</strong> мережу до вихідної розмітки — вони не входять до жодного
        структурного циклу. Така подія відбувається <em>один раз</em> уздовж шляху і назавжди
        змінює стан системи (наприклад, веде у тупик або у незворотну гілку).
      </p>
      <p>
        Обидва результати правильні: «потенційна живість» дерева — слабка властивість (досить
        одного спрацювання), а «послідовність» матриці вимагає циклічної участі в інваріанті.
      </p>
    </div>
  );
}

function renderBoundedDetail(status: ComparisonRow['status']): React.ReactNode {
  if (status !== 'matrix-weaker') return undefined;
  return (
    <div className="space-y-1.5">
      <p>
        Дерево показує, що всі позиції обмежені (немає ω-маркувань). Поведінково мережа
        не може породити необмежене зростання фішок з μ₀.
      </p>
      <p>
        Проте матриця не знайшла <em>повного</em> позитивного P-інваріанта — такого, що
        покриває кожну позицію ненульовою вагою. Матричний критерій обмеженості є{' '}
        <strong>достатнім, але не необхідним</strong>: обмеженість може випливати з
        топології мережі та конкретного μ₀, не маючи формального вираження через ваговий
        інваріант. Це не суперечність, лише різна сила методів.
      </p>
    </div>
  );
}

function classify(
  label: string,
  matrixOk: boolean,
  treeOk: boolean,
  notes: {
    confirmed: string;
    consistent: string;
    matrixStronger: string; // matrixOk && !treeOk
    treeStronger: string;   // !matrixOk && treeOk
  },
): ComparisonRow {
  if (matrixOk && treeOk) {
    return { label, matrixOk, treeOk, status: 'confirmed', note: notes.confirmed };
  }
  if (!matrixOk && !treeOk) {
    return { label, matrixOk, treeOk, status: 'consistent', note: notes.consistent };
  }
  if (matrixOk && !treeOk) {
    // Matrix says yes, tree says no — usually contradiction OR matrix is structurally finer
    const isContradiction = notes.matrixStronger.startsWith('СУПЕРЕЧНІСТЬ');
    return {
      label,
      matrixOk,
      treeOk,
      status: isContradiction ? 'contradiction' : 'tree-weaker',
      note: notes.matrixStronger,
    };
  }
  // !matrixOk && treeOk
  const isContradiction = notes.treeStronger.startsWith('СУПЕРЕЧНІСТЬ');
  return {
    label,
    matrixOk,
    treeOk,
    status: isContradiction ? 'contradiction' : 'matrix-weaker',
    note: notes.treeStronger,
  };
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const yesNoCell = (ok: boolean) => (
    <span
      className={`inline-block text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
        ok
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-slate-600 bg-slate-50 border-slate-200'
      }`}
    >
      {ok ? 'так' : 'ні'}
    </span>
  );

  const statusBadge = (s: ComparisonRow['status']) => {
    switch (s) {
      case 'confirmed':
        return (
          <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
            обидва підтверджують
          </span>
        );
      case 'consistent':
        return (
          <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
            обидва не виявляють
          </span>
        );
      case 'matrix-weaker':
        return (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            виявлено лише деревом
          </span>
        );
      case 'tree-weaker':
        return (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            виявлено лише матрицями
          </span>
        );
      case 'contradiction':
        return (
          <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            конфлікт результатів
          </span>
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="text-[11px] border-collapse w-full">
          <thead>
            <tr>
              <th className="border border-border px-1.5 py-1 bg-muted/60 text-muted-foreground font-semibold text-left">
                Властивість
              </th>
              <th className="border border-border px-1.5 py-1 bg-muted/60 text-muted-foreground font-semibold text-center">
                За матрицями
              </th>
              <th className="border border-border px-1.5 py-1 bg-muted/60 text-muted-foreground font-semibold text-center">
                За деревом
              </th>
              <th className="border border-border px-1.5 py-1 bg-muted/60 text-muted-foreground font-semibold text-center">
                Підсумок
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-border px-1.5 py-1 font-medium">{r.label}</td>
                <td className="border border-border px-1.5 py-1 text-center">
                  {yesNoCell(r.matrixOk)}
                </td>
                <td className="border border-border px-1.5 py-1 text-center">
                  {yesNoCell(r.treeOk)}
                </td>
                <td className="border border-border px-1.5 py-1 text-center">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 text-[11px] leading-snug">
        {rows.map((r, i) => (
          <li key={i} className="space-y-1">
            <div className="flex gap-1.5">
              <span className="text-muted-foreground shrink-0">·</span>
              <span>
                <strong>{r.label}:</strong> {r.note}
              </span>
            </div>
            {r.detail && (
              <div className="ml-3">
                <Details title="Чому такий результат?">
                  <div className="text-[11px] leading-relaxed space-y-1.5">{r.detail}</div>
                </Details>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

