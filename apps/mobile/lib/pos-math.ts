/**
 * POS Math & Cashier Tender Utilities
 * Provides safe expression parsing (without eval/Function), change calculations,
 * and smart denomination shortcuts for retail cashier environments.
 */

export { DEFAULT_UNIFIED_CATALOG } from './pos-data';

export interface ChangeResult {
  total: number;
  paid: number;
  change: number;
  isExact: boolean;
  isOverpaid: boolean;
  isUnderpaid: boolean;
  difference: number;
}

/**
 * Calculates change, overpayment, and underpayment in real-time.
 */
export function calculateChange(total: number, paid: number): ChangeResult {
  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  const safePaid = Math.max(0, Number.isFinite(paid) ? paid : 0);

  // Round to 2 decimal places to avoid floating point issues
  const roundedTotal = Math.round(safeTotal * 100) / 100;
  const roundedPaid = Math.round(safePaid * 100) / 100;

  const diff = Math.round((roundedPaid - roundedTotal) * 100) / 100;

  if (diff === 0) {
    return {
      total: roundedTotal,
      paid: roundedPaid,
      change: 0,
      isExact: true,
      isOverpaid: false,
      isUnderpaid: false,
      difference: 0,
    };
  }

  if (diff > 0) {
    return {
      total: roundedTotal,
      paid: roundedPaid,
      change: diff,
      isExact: false,
      isOverpaid: true,
      isUnderpaid: false,
      difference: diff,
    };
  }

  return {
    total: roundedTotal,
    paid: roundedPaid,
    change: 0,
    isExact: false,
    isOverpaid: false,
    isUnderpaid: true,
    difference: Math.abs(diff),
  };
}

/**
 * Common note denominations for retail transactions (e.g. Zambian Kwacha / ZMW)
 */
export const STANDARD_DENOMINATIONS = [10, 20, 50, 100, 200, 500];

/**
 * Generates smart tender shortcuts for a given sale total.
 * For example, if total is 135:
 * Returns: [135, 140, 150, 200, 500]
 */
export function getSuggestedTenderShortcuts(total: number): number[] {
  if (total <= 0) return [10, 20, 50, 100, 200];

  const shortcuts = new Set<number>();

  // 1. Exact amount
  shortcuts.add(Math.round(total * 100) / 100);

  // 2. Next multiple of 10
  if (total % 10 !== 0) {
    shortcuts.add(Math.ceil(total / 10) * 10);
  }

  // 3. Next multiple of 50
  if (total % 50 !== 0) {
    shortcuts.add(Math.ceil(total / 50) * 50);
  }

  // 4. Next multiple of 100
  if (total % 100 !== 0) {
    shortcuts.add(Math.ceil(total / 100) * 100);
  }

  // 5. Relevant standard note denominations above or equal to total
  for (const denom of STANDARD_DENOMINATIONS) {
    if (denom >= total) {
      shortcuts.add(denom);
    }
  }

  // If no note is higher than total (e.g. big order > 500), add next 500 multiple
  if (total > 500) {
    shortcuts.add(Math.ceil(total / 500) * 500);
    shortcuts.add(Math.ceil(total / 1000) * 1000);
  }

  // Sort ascending and limit to top 6 shortcuts
  return Array.from(shortcuts)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

/**
 * Token types for safe arithmetic parser
 */
type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Lexer for math expressions (supports digits, decimals, +, -, *, /, (, ))
 */
function tokenize(expr: string): Token[] {
  const clean = expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  const tokens: Token[] = [];
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(clean[i + 1] || ''))) {
      let num = ch;
      i++;
      let hasDot = ch === '.';
      while (
        i < clean.length &&
        (/\d/.test(clean[i]) || (clean[i] === '.' && !hasDot))
      ) {
        if (clean[i] === '.') hasDot = true;
        num += clean[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      // Check for unary minus: at start of expression or following another operator / lparen
      const prev = tokens[tokens.length - 1];
      if (
        ch === '-' &&
        (!prev || prev.type === 'OP' || prev.type === 'LPAREN')
      ) {
        // Unary minus: treat as part of next number if followed by digits
        if (
          i + 1 < clean.length &&
          (/\d/.test(clean[i + 1]) || clean[i + 1] === '.')
        ) {
          i++;
          let num = '-' + clean[i];
          i++;
          let hasDot = clean[i - 1] === '.';
          while (
            i < clean.length &&
            (/\d/.test(clean[i]) || (clean[i] === '.' && !hasDot))
          ) {
            if (clean[i] === '.') hasDot = true;
            num += clean[i];
            i++;
          }
          tokens.push({ type: 'NUMBER', value: num });
          continue;
        }
      }
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Ignore unknown character or advance
    i++;
  }

  return tokens;
}

/**
 * Safe Recursive Descent Parser / Evaluator
 * Evaluates math expressions securely with ZERO use of eval() or Function().
 */
export function safeCalculate(expression: string): {
  success: boolean;
  result?: number;
  error?: string;
} {
  if (!expression || !expression.trim()) {
    return { success: false, error: 'Empty expression' };
  }

  // Prevent denial-of-service on overly long strings
  if (expression.length > 80) {
    return { success: false, error: 'Expression is too long' };
  }

  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return { success: false, error: 'No valid math tokens found' };
    }

    let pos = 0;

    function peek(): Token | undefined {
      return tokens[pos];
    }

    function consume(): Token {
      return tokens[pos++];
    }

    // Grammar:
    // expr   := term (('+' | '-') term)*
    // term   := factor (('*' | '/') factor)*
    // factor := NUMBER | '(' expr ')'

    function parseExpr(): number {
      let value = parseTerm();
      while (pos < tokens.length) {
        const next = peek();
        if (
          next &&
          next.type === 'OP' &&
          (next.value === '+' || next.value === '-')
        ) {
          consume();
          const right = parseTerm();
          if (next.value === '+') value += right;
          else value -= right;
        } else {
          break;
        }
      }
      return value;
    }

    function parseTerm(): number {
      let value = parseFactor();
      while (pos < tokens.length) {
        const next = peek();
        if (
          next &&
          next.type === 'OP' &&
          (next.value === '*' || next.value === '/')
        ) {
          consume();
          const right = parseFactor();
          if (next.value === '*') {
            value *= right;
          } else {
            if (right === 0) {
              throw new Error('Division by zero');
            }
            value /= right;
          }
        } else {
          break;
        }
      }
      return value;
    }

    function parseFactor(): number {
      const token = peek();
      if (!token) throw new Error('Unexpected end of expression');

      if (token.type === 'NUMBER') {
        consume();
        const num = Number(token.value);
        if (!Number.isFinite(num)) throw new Error('Invalid number');
        return num;
      }

      if (token.type === 'LPAREN') {
        consume();
        const inner = parseExpr();
        const close = peek();
        if (!close || close.type !== 'RPAREN') {
          throw new Error('Missing closing parenthesis');
        }
        consume();
        return inner;
      }

      throw new Error(`Unexpected token: ${token.value}`);
    }

    const res = parseExpr();

    if (pos < tokens.length) {
      return {
        success: false,
        error: `Unexpected extra token: ${tokens[pos].value}`,
      };
    }

    if (!Number.isFinite(res)) {
      return {
        success: false,
        error: 'Calculation resulted in non-finite number',
      };
    }

    // Round to 4 decimal places for precision display
    const rounded = Math.round(res * 10000) / 10000;
    return { success: true, result: rounded };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid math expression',
    };
  }
}
