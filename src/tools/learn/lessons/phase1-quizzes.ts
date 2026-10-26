import type { BugStep, CompareStep, GradedStep, Lesson, ParsonsStep, PredictStep, TraceStep } from "../types";

/**
 * Three short quizzes per Phase 1 lesson (owner's ask, 2026-10-26): a quick check right after the
 * lesson, practice on new examples, and a mixed refresher that brings back earlier lessons
 * (retrieval + interleaving; see /private/learn/method). Four tap-friendly questions each. Answers
 * go into the same review boxes as the lessons. The tests run every predict and trace snippet
 * that is plain JavaScript, so the answer keys are checked against real output.
 */

const P = (id: string, prompt: string, code: string | undefined, choices: string[], answer: number, why: string): PredictStep => ({ kind: "predict", id, prompt, code, choices, answer, why });
const T = (id: string, prompt: string, code: string, rows: TraceStep["rows"], why: string): TraceStep => ({ kind: "trace", id, prompt, code, rows, why });
const B = (id: string, prompt: string, code: string, line: number, why: string): BugStep => ({ kind: "bug", id, prompt, code, line, why });
const C = (id: string, prompt: string, a: string, b: string, answer: "a" | "b", why: string): CompareStep => ({ kind: "compare", id, prompt, a, b, answer, why });
const O = (id: string, prompt: string, lines: string[], why: string, distractors?: string[]): ParsonsStep => ({ kind: "parsons", id, prompt, lines, distractors, why });

const WHAT = "What prints?";

type Three = readonly [readonly GradedStep[], readonly GradedStep[], readonly GradedStep[]];

const QUIZZES: Record<string, Three> = {
  /* ───────── 1.1 How to read a program ───────── */
  "p1-reading": [
    [
      P("a", WHAT, `console.log("Set");\nconsole.log("Strike");`, ["Set\nStrike", "Strike\nSet", "SetStrike", "Set"], 0, "Two prints, top to bottom."),
      P("b", "A comment can sit at the end of a line too. What prints?", `console.log("Doors"); // opens at 7`, ["Doors", "Doors // opens at 7", "Doors opens at 7", "Nothing"], 0, "Everything after `//` on that line is a comment. The `console.log` before it still runs."),
      B("c", "This should print three lines but prints two. Which line is the problem?", `console.log("Pack");\n// console.log("Load");\nconsole.log("Drive");`, 2, "Line 2 is commented out with `//`, so it never runs."),
      P("d", WHAT, `console.log("Truss: 40 ft");`, ["Truss: 40 ft", "\"Truss: 40 ft\"", "Truss:40ft", "Truss"], 0, "The text inside the quotes prints exactly, spaces and colon included. The quotes themselves don't print."),
    ],
    [
      P("a", WHAT, `console.log("1");\n// console.log("2");\nconsole.log("3");\n// console.log("4");`, ["1\n2\n3\n4", "1\n3", "2\n4", "1"], 1, "Lines 2 and 4 are comments. Only 1 and 3 run."),
      P("b", "Spaces outside the quotes don't matter. What prints?", `console.log(  "A"  );\nconsole.log("B" );`, ["A\nB", " A \nB", "A B", "AB"], 0, "Only what's inside the quotes is printed. Extra spaces around the brackets are ignored."),
      O("c", "Put these in order so the crew call prints: Load in, Rig, Focus.", [`console.log("Load in");`, `console.log("Rig");`, `console.log("Focus");`], "Prints come out in the order the lines are written."),
      P("d", "How many lines does this print?", `console.log("a");\nconsole.log("b");\n// console.log("c");\nconsole.log("d");`, ["2", "3", "4", "5"], 1, "Four prints, one of them commented out: three lines."),
    ],
    [
      B("a", "This stops with an error instead of printing Ready. Which line?", `console.log("Check");\nconsole.log(Ready);\nconsole.log("Go");`, 2, "Without quotes, `Ready` isn't text: JavaScript looks for a variable called Ready, finds none, and stops with \"ReferenceError: Ready is not defined\"."),
      P("b", "Careful: what prints?", `console.log("// not a comment");`, ["// not a comment", "Nothing", "not a comment", "An error"], 0, "Inside quotes, `//` is just text. It only starts a comment when it's outside a string."),
      P("c", WHAT, `// console.log("A");\nconsole.log("B");\n// console.log("C");`, ["A\nB\nC", "B", "A\nC", "Nothing"], 1, "Only the middle line isn't a comment."),
      C("d", "Which one prints `Hello` and `World` on two separate lines?", `console.log("Hello World");`, `console.log("Hello");\nconsole.log("World");`, "b", "Each `console.log` prints one line. A prints a single line, \"Hello World\"."),
    ],
  ],

  /* ───────── 1.2 Variables ───────── */
  "p1-variables": [
    [
      P("a", WHAT, `let x = 4;\nx = 9;\nconsole.log(x);`, ["4", "9", "13", "x"], 1, "Line 2 replaces the 4 with 9. A variable holds one value at a time."),
      T("b", "Trace it. What do `a` and `b` hold at the end?", `let a = 1;\nlet b = a;\na = a + 5;`, [{ label: "a", answer: "6" }, { label: "b", answer: "1" }], "`b` got a copy of 1. Changing `a` afterwards doesn't change `b`."),
      P("c", WHAT, `const crew = 6;\nconsole.log("crew");`, ["6", "crew", "\"crew\"", "undefined"], 1, "With quotes it's the word \"crew\", not the variable. Without quotes it would print 6."),
      B("d", "This stops with an error. Which line?", `const shows = 1;\nshows = shows + 1;\nconsole.log(shows);`, 2, "`shows` was made with `const`, so it can't get a new value. It would need `let`."),
    ],
    [
      T("a", "Trace it. What is `total` at the end?", `let total = 10;\ntotal = total - 3;\ntotal = total * 2;`, [{ label: "total", answer: "14" }], "10 − 3 is 7, then 7 × 2 is 14. Each line uses the value from the line before."),
      P("b", "Someone tries to swap two values. What prints?", `let a = 2;\nlet b = 3;\na = b;\nb = a;\nconsole.log(a, b);`, ["3 2", "2 3", "3 3", "2 2"], 2, "After `a = b`, both hold 3; the 2 is gone. Then `b = a` copies 3 again. Swapping needs a third variable to hold one value."),
      O("c", "Swap them so `a` ends as 2 and `b` as 1. One line doesn't belong.", ["let a = 1;", "let b = 2;", "const temp = a;", "a = b;", "b = temp;"], "Save `a` in `temp` first, then `a` can take `b`'s value, and `b` takes the saved one.", ["b = a;"]),
      P("d", WHAT, `let n = 5;\nn = n + n;\nconsole.log(n);`, ["5", "10", "55", "n + n"], 1, "Right side first: 5 + 5 is 10, then it's stored in `n`."),
    ],
    [
      P("a", "Mixed with 1.1. What prints?", `let s = 1;\n// s = 99;\nconsole.log(s);`, ["1", "99", "100", "Nothing"], 0, "Line 2 is a comment, so `s` keeps its 1."),
      T("b", "Trace it. What are `p` and `q` at the end?", `let p = 3;\nlet q = p * 2;\np = 10;\nq = q + p;`, [{ label: "p", answer: "10" }, { label: "q", answer: "16" }], "`q` starts as 6. `p` becomes 10, then `q` is 6 + 10 = 16."),
      B("c", "This should print 3, but prints the word nights. Which line?", `let nights = 3;\nconsole.log("nights");`, 2, "The quotes make it the word, not the variable. It should be `console.log(nights);`."),
      P("d", WHAT, `let a = "x";\na = "y";\na = "z";\nconsole.log(a);`, ["x", "y", "z", "xyz"], 2, "Each assignment replaces the last. Only \"z\" is left."),
    ],
  ],

  /* ───────── 1.3 Values and types ───────── */
  "p1-values": [
    [
      P("a", WHAT, `console.log(2 + 2);\nconsole.log("2" + "2");`, ["4\n4", "4\n22", "22\n22", "4\n\"22\""], 1, "Numbers add: 4. Strings glue: \"22\" (printed without quotes)."),
      P("b", WHAT, `console.log(typeof true);`, ["boolean", "true", "string", "undefined"], 0, "`true` without quotes is a boolean."),
      P("c", WHAT, `let r;\nconsole.log(r);`, ["undefined", "null", "0", "An error"], 0, "A variable declared but never given a value holds `undefined`."),
      T("d", "Write each value as JavaScript shows it (quotes for strings).", `const a = "7" + 1;\nconst b = 7 + 1;`, [{ label: "a", answer: "\"71\"", quoted: true }, { label: "b", answer: "8" }], "`a`: a string on one side, so it glues: \"71\". `b`: two numbers add to 8."),
    ],
    [
      P("a", "Left to right. What prints?", `console.log("Site " + 4 + 2);`, ["Site 6", "Site 42", "Site 4 2", "6"], 1, "\"Site \" + 4 is already text, \"Site 4\", so the 2 glues on too: \"Site 42\"."),
      P("b", "Now the numbers come first. What prints?", `console.log(4 + 2 + " sites");`, ["42 sites", "6 sites", "4 2 sites", "6"], 1, "4 + 2 is 6 (both numbers) before the string arrives, then 6 + \" sites\" glues."),
      P("c", WHAT, `console.log(typeof "true");`, ["boolean", "string", "true", "undefined"], 1, "Quotes make it a string, even though the word inside is true."),
      B("d", "This should print 5 but prints 23. Which line is the cause?", `const a = "2";\nconst b = 3;\nconsole.log(a + b);`, 1, "`a` is the string \"2\" because of the quotes, so `+` glues. Line 3 is where it shows; line 1 is the cause."),
    ],
    [
      T("a", "Trace it (quotes for strings). What is `n` at the end?", `let n = "1";\nn = n + 1;\nn = n + 1;`, [{ label: "n", answer: "\"111\"", quoted: true }], "\"1\" + 1 glues to \"11\", then \"11\" + 1 glues to \"111\". It stays a string the whole time."),
      P("b", WHAT, `const x = 5;\nconsole.log(typeof x + 1);`, ["6", "number1", "number", "An error"], 1, "`typeof x` runs first and gives the string \"number\"; then \"number\" + 1 glues."),
      P("c", "Mixed with 1.2. What prints?", `let a = 10;\nlet b = a;\na = "ten";\nconsole.log(b);`, ["10", "ten", "undefined", "An error"], 0, "`b` copied 10. Changing `a` later doesn't touch it."),
      P("d", WHAT, `console.log(Number("4") + 1);`, ["41", "5", "\"5\"", "NaN"], 1, "`Number(\"4\")` turns the text into the number 4, so `+` adds: 5. This is how text from a form gets fixed."),
    ],
  ],

  /* ───────── 1.4 Decisions ───────── */
  "p1-decisions": [
    [
      P("a", WHAT, `const n = 10;\nif (n > 5) {\n  console.log("big");\n} else {\n  console.log("small");\n}`, ["big", "small", "big\nsmall", "Nothing"], 0, "10 > 5 is true, so the first branch runs and `else` is skipped."),
      P("b", WHAT, `console.log(3 === "3");`, ["true", "false", "undefined", "An error"], 1, "`===` checks the type too: a number is never the same as a string."),
      T("c", "Write `true` or `false` for each.", `const a = true && false;\nconst b = true || false;\nconst c = !true;`, [{ label: "a", answer: "false" }, { label: "b", answer: "true" }, { label: "c", answer: "false" }], "AND needs both: false. OR needs one: true. `!` flips true to false."),
      P("d", "Exactly on the limit. What prints?", `const load = 500;\nif (load >= 500) {\n  console.log("At limit");\n} else {\n  console.log("Under");\n}`, ["At limit", "Under", "At limit\nUnder", "Nothing"], 0, "`>=` means \"at least\", so 500 counts."),
    ],
    [
      P("a", WHAT, `const temp = 72;\nif (temp > 90) {\n  console.log("Hot");\n} else if (temp > 60) {\n  console.log("Mild");\n} else {\n  console.log("Cold");\n}`, ["Hot", "Mild", "Cold", "Mild\nCold"], 1, "72 isn't over 90; it is over 60, so \"Mild\", and the chain stops."),
      P("b", "0 counts as false in an if. What prints?", `const sitesLeft = 0;\nif (sitesLeft) {\n  console.log("yes");\n} else {\n  console.log("no");\n}`, ["yes", "no", "0", "Nothing"], 1, "An if treats 0, empty text \"\", `null` and `undefined` as false. So `else` runs."),
      B("c", "It should say Book only when the site is open AND you need 3 nights or fewer. It says Book far too often. Which line?", `const open = false;\nconst nights = 2;\nif (open || nights <= 3) {\n  console.log("Book");\n}`, 3, "`||` is OR: one true side is enough, so a closed site still says Book. It should be `&&`."),
      P("d", WHAT, `console.log(5 == "5", 5 === "5");`, ["true true", "true false", "false false", "false true"], 1, "`==` converts the string first, so true. `===` checks the type too, so false."),
    ],
    [
      P("a", "Mixed with 1.3. What prints?", `const nights = "3";\nif (nights === 3) {\n  console.log("match");\n} else {\n  console.log("no match");\n}`, ["match", "no match", "3", "An error"], 1, "\"3\" is a string and 3 is a number, so `===` says false."),
      T("b", "Trace it. What is `s` at the end?", `let s = 0;\nconst ok = true;\nif (ok) {\n  s = s + 2;\n}\nif (!ok) {\n  s = s + 10;\n}\ns = s + 1;`, [{ label: "s", answer: "3" }], "First if runs (+2). Second doesn't (`!ok` is false). The last line always runs (+1): 3."),
      P("c", "Mixed with 1.3. What prints?", `const a = 4;\nconst b = "4";\nconsole.log(a + b);`, ["8", "44", "false", "An error"], 1, "One side is a string, so `+` glues: \"44\"."),
      B("d", "A 45-foot rig on a 40-foot pad should say Too long, but it says Fits. Which line?", `const max = 40;\nconst rig = 45;\nif (rig < max) {\n  console.log("Too long");\n} else {\n  console.log("Fits");\n}`, 3, "The comparison is backwards: a rig is too long when it's MORE than the max. It should be `rig > max`."),
    ],
  ],

  /* ───────── 1.5 Arrays ───────── */
  "p1-arrays": [
    [
      P("a", WHAT, `const a = ["x", "y", "z"];\nconsole.log(a[0]);`, ["x", "y", "z", "undefined"], 0, "Counting starts at 0, so index 0 is the first item."),
      P("b", WHAT, `const days = ["Thu", "Fri", "Sat", "Sun"];\nconsole.log(days.length);`, ["3", "4", "5", "Sun"], 1, "`length` counts the items: 4. (The last index is 3.)"),
      T("c", "Trace it.", `const s = ["A"];\ns.push("B");\ns.push("C");\nconst n = s.length;\nconst last = s[s.length - 1];`, [{ label: "n", answer: "3" }, { label: "last", answer: "\"C\"", accept: ["C"] }], "Two pushes make three items; the last is at index 2: \"C\"."),
      B("d", "This should print the last of three campgrounds, but prints undefined. Which line?", `const parks = ["Wawona", "Hodgdon", "Crane Flat"];\nconsole.log(parks[3]);`, 2, "Three items sit at indexes 0, 1 and 2. Index 3 doesn't exist. It should be `parks[2]` or `parks[parks.length - 1]`."),
    ],
    [
      P("a", WHAT, `const a = [10, 20, 30];\nconsole.log(a[1] + a[2]);`, ["30", "50", "40", "2030"], 1, "`a[1]` is 20 and `a[2]` is 30; both numbers, so they add to 50."),
      P("b", WHAT, `const nights = ["Fri"];\nconsole.log(nights[1]);`, ["Fri", "undefined", "1", "An error"], 1, "One item, at index 0. Index 1 has nothing: `undefined`."),
      P("c", WHAT, `const a = [5, 6, 7];\na[0] = 9;\nconsole.log(a[0] + a[2]);`, ["12", "16", "14", "97"], 1, "Line 2 replaces the 5 with 9, so it's 9 + 7 = 16."),
      C("d", "Both should print the FIRST site. Which one does?", `const sites = ["A1", "A2", "A3"];\nconsole.log(sites[1]);`, `const sites = ["A1", "A2", "A3"];\nconsole.log(sites[0]);`, "b", "The first item is at index 0. A prints A2, the second item."),
    ],
    [
      P("a", "Mixed with 1.3. What prints?", `const sites = ["A1", "A2"];\nconsole.log("Site " + sites[1]);`, ["Site A1", "Site A2", "Site 1", "Site undefined"], 1, "Index 1 is the second item, A2, glued onto the text."),
      T("b", "Trace it.", `const a = [1, 2];\na.push(a.length);`, [{ label: "a.length", answer: "3" }, { label: "a[2]", answer: "2" }], "`a.length` is 2 when the push runs, so 2 is added at the end. Then there are 3 items, and index 2 holds 2."),
      P("c", "Mixed with 1.4. What prints?", `const n = ["a", "b", "c"];\nif (n.length > 2) {\n  console.log("long");\n} else {\n  console.log("short");\n}`, ["long", "short", "3", "Nothing"], 0, "Three items, and 3 > 2 is true."),
      P("d", WHAT, `const a = [1, 2, 3];\nconsole.log(a[a.length - 1] === 3);`, ["true", "false", "3", "undefined"], 0, "`a.length - 1` is 2, and `a[2]` is 3, so the comparison is true."),
    ],
  ],

  /* ───────── 1.6 Objects ───────── */
  "p1-objects": [
    [
      P("a", WHAT, `const w = { park: "Wawona", nights: 2 };\nconsole.log(w.park);`, ["Wawona", "park", "2", "undefined"], 0, "Read a property with a dot: `w.park` is \"Wawona\"."),
      P("b", WHAT, `const w = { park: "Wawona", nights: 2 };\nconsole.log(w.price);`, ["0", "undefined", "price", "An error"], 1, "There's no `price` property, so it reads as `undefined` (not an error)."),
      P("c", WHAT, `const a = { n: 1 };\nconst b = a;\nb.n = 7;\nconsole.log(a.n);`, ["1", "7", "undefined", "An error"], 1, "`a` and `b` are two names for one object, so the change shows through both."),
      T("d", "Trace it. What is `L`?", `const s = { id: "B7", len: 30 };\ns.len = s.len + 5;\nconst L = s.len;`, [{ label: "L", answer: "35" }], "30 + 5 is stored back in `s.len`, then copied into `L`."),
    ],
    [
      P("a", WHAT, `const a = [1];\nconst b = a;\nb.push(2);\nconsole.log(a.length);`, ["1", "2", "undefined", "An error"], 1, "One array, two names. The push through `b` changes the only array there is."),
      P("b", WHAT, `const a = { n: 1 };\nconst b = { ...a };\nb.n = 9;\nconsole.log(a.n);`, ["1", "9", "undefined", "An error"], 0, "`{ ...a }` makes a new object, so changing `b` leaves `a` alone."),
      P("c", WHAT, `const w = { sites: ["A1", "B2"] };\nconsole.log(w.sites[1]);`, ["A1", "B2", "sites", "undefined"], 1, "`w.sites` is the array; index 1 is its second item."),
      B("d", "After this runs, `defaults.nights` is 5, which nobody wanted. Which line causes it?", `const defaults = { nights: 2 };\nconst mine = defaults;\nmine.nights = 5;`, 2, "Line 2 doesn't copy: both names point at one object. `const mine = { ...defaults };` would make a separate copy."),
    ],
    [
      P("a", "Mixed with 1.2. Plain numbers this time. What prints?", `let a = 2;\nlet b = a;\nb = 5;\nconsole.log(a);`, ["2", "5", "undefined", "An error"], 0, "Numbers are copied. Giving `b` a new value doesn't change `a`."),
      T("b", "Mixed with 1.3. Quotes for strings. What is `t`?", `const w = { nights: "2" };\nconst t = w.nights + 1;`, [{ label: "t", answer: "\"21\"", quoted: true }], "`w.nights` is the string \"2\", so `+` glues: \"21\"."),
      P("c", "Mixed with 1.4. What prints?", `const r = { open: true, sites: 0 };\nif (r.open && r.sites > 0) {\n  console.log("Book");\n} else {\n  console.log("Wait");\n}`, ["Book", "Wait", "Book\nWait", "Nothing"], 1, "Open is true, but 0 > 0 is false, so AND is false."),
      P("d", "Two objects that look the same. What prints?", `console.log({ a: 1 } === { a: 1 });`, ["true", "false", "undefined", "An error"], 1, "Each `{ }` makes a separate object. `===` on objects asks \"is it the SAME one?\", not \"do they look alike?\"."),
    ],
  ],

  /* ───────── 1.7 Functions ───────── */
  "p1-functions": [
    [
      P("a", WHAT, `function add(a, b) {\n  return a + b;\n}\nconsole.log(add(2, 3));`, ["5", "23", "a + b", "undefined"], 0, "The call fills `a` with 2 and `b` with 3; it returns 5."),
      P("b", WHAT, `function f() {\n  return 1;\n  console.log("x");\n}\nconsole.log(f());`, ["1", "x\n1", "1\nx", "undefined"], 0, "`return` leaves the function at once, so the `console.log(\"x\")` never runs."),
      P("c", WHAT, `function g(n) {\n  console.log(n * 2);\n}\nconst r = g(3);\nconsole.log(r);`, ["6\n6", "6\nundefined", "undefined", "6"], 1, "`g` prints 6 while it runs but returns nothing, so `r` is `undefined`."),
      T("d", "Trace the calls.", `function half(n) {\n  return n / 2;\n}\nconst a = half(10);\nconst b = half(a);`, [{ label: "a", answer: "5" }, { label: "b", answer: "2.5" }], "half(10) is 5. half(5) is 2.5."),
    ],
    [
      P("a", WHAT, `function greet(name) {\n  return "Hi " + name;\n}\nconsole.log(greet("crew"));`, ["Hi crew", "Hi name", "greet", "undefined"], 0, "`name` is filled with \"crew\" for this call."),
      P("b", "Edge case. What prints?", `function sign(x) {\n  if (x > 0) {\n    return "pos";\n  }\n  return "not pos";\n}\nconsole.log(sign(0));`, ["pos", "not pos", "0", "undefined"], 1, "0 > 0 is false, so it skips to the last `return`."),
      B("c", "`total(2, 3)` should give 5 but gives -1. Which line?", `function total(a, b) {\n  return a - b;\n}`, 2, "It subtracts instead of adding."),
      C("d", "Both work out a stay's cost. The result needs to be used later (added to fees). Which is right?", `function cost(nights, price) {\n  console.log(nights * price);\n}`, `function cost(nights, price) {\n  return nights * price;\n}`, "b", "A only shows the number; the caller gets `undefined` and can't add to it. B hands the value back."),
    ],
    [
      P("a", "Mixed with 1.5. What prints?", `function first(list) {\n  return list[0];\n}\nconsole.log(first(["a", "b"]));`, ["a", "b", "undefined", "[\"a\", \"b\"]"], 0, "It returns index 0 of whatever list it gets."),
      T("b", "Trace it.", `function dbl(n) {\n  return n * 2;\n}\nlet x = 1;\nx = dbl(x);\nx = dbl(x);`, [{ label: "x", answer: "4" }], "1 doubled is 2, then 2 doubled is 4."),
      P("c", "Mixed with 1.3 and 1.4. What prints?", `function isOpen(s) {\n  return s.open === true;\n}\nconsole.log(isOpen({ open: "true" }));`, ["true", "false", "undefined", "An error"], 1, "\"true\" in quotes is a string, and `===` checks the type, so it's false."),
      P("d", "Mixed with 1.6. What prints?", `function setFive(o) {\n  o.n = 5;\n}\nconst box = { n: 1 };\nsetFive(box);\nconsole.log(box.n);`, ["1", "5", "undefined", "An error"], 1, "The function gets the same object (not a copy), so its change sticks."),
    ],
  ],

  /* ───────── 1.8 Loops ───────── */
  "p1-loops": [
    [
      P("a", WHAT, `for (const x of ["a", "b"]) {\n  console.log(x);\n}`, ["a\nb", "ab", "a", "x\nx"], 0, "Once per item, with `x` set to that item."),
      T("b", "Trace the running total.", `let t = 0;\nfor (const n of [1, 2, 3]) {\n  t = t + n;\n}`, [{ label: "t", answer: "6" }], "0 + 1, then + 2, then + 3: 6."),
      P("c", "How many lines does this print?", `for (let i = 0; i < 3; i++) {\n  console.log(i);\n}`, ["2", "3", "4", "It never stops"], 1, "`i` is 0, 1, 2. At 3, `3 < 3` is false and it stops."),
      B("d", "This prints one `undefined` too many. Which line?", `const sites = ["A1", "B2", "C3"];\nfor (let i = 0; i <= sites.length; i++) {\n  console.log(sites[i]);\n}`, 2, "`<=` lets `i` reach 3, past the end. It should be `<`."),
    ],
    [
      P("a", WHAT, `let s = "";\nfor (const c of ["x", "y", "z"]) {\n  s = s + c;\n}\nconsole.log(s);`, ["xyz", "zyx", "x", "\"\""], 0, "Starting from empty text, each round glues one letter on the end."),
      T("b", "Trace it. How many are 2 or more?", `let count = 0;\nfor (const n of [1, 2, 3, 2]) {\n  if (n >= 2) {\n    count = count + 1;\n  }\n}`, [{ label: "count", answer: "3" }], "2, 3 and 2 qualify; 1 doesn't."),
      P("c", "Counting down. What prints?", `for (let i = 3; i > 0; i--) {\n  console.log(i);\n}`, ["3\n2\n1", "3\n2\n1\n0", "1\n2\n3", "2\n1\n0"], 0, "`i--` takes 1 off each round. At 0, `0 > 0` is false, so 0 never prints."),
      C("d", "Both should add up the list. Which is right?", `let total = 0;\nfor (const n of list) {\n  total = total + n;\n}`, `for (const n of list) {\n  let total = 0;\n  total = total + n;\n}`, "a", "In B the total is reset to 0 every round. A running total starts before the loop."),
    ],
    [
      P("a", "Mixed with 1.5. What prints?", `const a = [2, 4];\nlet t = 0;\nfor (const n of a) {\n  t = t + n;\n}\nconsole.log(t / a.length);`, ["6", "3", "2", "1.5"], 1, "The total is 6 and there are 2 items: 6 / 2 = 3, the average."),
      T("b", "Trace it. What does `max` end as?", `let max = 0;\nfor (const n of [3, 9, 4]) {\n  if (n > max) {\n    max = n;\n  }\n}`, [{ label: "max", answer: "9" }], "It keeps the biggest seen so far: 3, then 9; 4 isn't bigger than 9."),
      P("c", "Mixed with 1.6. What prints?", `const sites = [{ id: "A", open: false }, { id: "B", open: true }];\nfor (const s of sites) {\n  if (s.open) {\n    console.log(s.id);\n  }\n}`, ["A", "B", "A\nB", "Nothing"], 1, "Only B is open."),
      B("d", "`sum([1, 2, 3])` gives 3 instead of 6. Which line?", `function sum(xs) {\n  let t = 0;\n  for (const x of xs) {\n    t = x;\n  }\n  return t;\n}`, 4, "`t = x` replaces the total each round, so only the last item is left. It should be `t = t + x`."),
    ],
  ],

  /* ───────── 1.9 map, filter, find ───────── */
  "p1-map-filter": [
    [
      P("a", WHAT, `console.log([1, 2, 3].map((n) => n * 2).length);`, ["3", "6", "12", "2"], 0, "`map` gives one result per item, so still 3 items."),
      P("b", WHAT, `console.log([1, 2, 3, 4].filter((n) => n > 2).length);`, ["1", "2", "3", "4"], 1, "Only 3 and 4 pass."),
      P("c", WHAT, `console.log([5, 8, 12].find((n) => n > 6));`, ["8", "12", "[8, 12]", "true"], 0, "`find` gives the FIRST match, as a single value."),
      P("d", WHAT, `console.log([1, 2].find((n) => n > 5));`, ["[]", "0", "undefined", "An error"], 2, "No match: `find` gives `undefined`."),
    ],
    [
      T("a", "Write the array like `[1, 2]`.", `const a = [1, 2, 3].map((n) => n * 10);`, [{ label: "a", answer: "[10, 20, 30]" }], "Every item times 10, same length."),
      T("b", "Write the array like `[\"A1\"]`.", `const b = ["A1", "B2", "A3"].filter((s) => s.startsWith("A"));`, [{ label: "b", answer: "[\"A1\", \"A3\"]" }], "Only the ones starting with A are kept, in their original order."),
      B("c", "This should keep the two long rigs but keeps none. Which line?", `const rigs = [18, 32, 40];\nconst long = rigs.filter((r) => { r > 30; });\nconsole.log(long.length);`, 2, "With braces, an arrow function needs `return`. Without it, every answer is `undefined`, which counts as false."),
      P("d", WHAT, `const inc = (n) => n + 1;\nconsole.log(inc(inc(1)));`, ["2", "3", "11", "undefined"], 1, "Inner call first: inc(1) is 2. Then inc(2) is 3."),
    ],
    [
      P("a", "Mixed with 1.6. What prints?", `const sites = [{ id: "A", len: 20 }, { id: "B", len: 35 }];\nconsole.log(sites.filter((s) => s.len >= 30).map((s) => s.id).join(","));`, ["A", "B", "A,B", ""], 1, "Only B is at least 30. `map` turns it into its id; `join` makes it text."),
      P("b", WHAT, `const a = [1, 2, 3];\nconst b = a.map((n) => n);\nb.push(4);\nconsole.log(a.length);`, ["3", "4", "undefined", "An error"], 0, "`map` always makes a NEW array, so pushing to `b` leaves `a` alone."),
      P("c", "Mixed with 1.8. What prints?", `let t = 0;\nfor (const n of [1, 2, 3].filter((n) => n !== 2)) {\n  t = t + n;\n}\nconsole.log(t);`, ["6", "4", "3", "5"], 1, "The 2 is filtered out, leaving 1 and 3: 4."),
      C("d", "Both get the first open site. Which would a reviewer prefer?", `const s = sites.filter((x) => x.open)[0];`, `const s = sites.find((x) => x.open);`, "b", "Same result, but `find` says what it means and stops at the first match. A builds a whole list to take one item."),
    ],
  ],

  /* ───────── 1.10 TypeScript ───────── */
  "p1-typescript": [
    [
      B("a", "Which line would TypeScript flag?", `let nights: number = 5;\nnights = "6";`, 2, "`nights` is typed as a number, and \"6\" is a string."),
      P("b", "In `interface Site { note?: string }`, what can `note` hold?", undefined, ["Only a string", "A string or undefined", "A string or a number", "Anything"], 1, "The `?` makes it optional, so it may be missing: `undefined`."),
      B("c", "Which line would TypeScript flag?", `function cost(nights: number): number {\n  return "free";\n}`, 2, "The `: number` after the brackets promises a number back, and \"free\" is a string."),
      P("d", "`let site: string | null = null;` Which of these is allowed next?", undefined, ["site = \"A1\";", "site = 5;", "site = true;", "site = [1];"], 0, "`string | null` allows a string or null, nothing else."),
    ],
    [
      P("a", "When does TypeScript check the types?", undefined, ["Every time the app runs", "When the code is written and built, before it runs", "Only when there's an error", "Never: it's just comments"], 1, "Types are checked while editing and building, then removed. Nothing checks them while the app runs."),
      B("b", "Which line would TypeScript flag?", `interface Site {\n  id: string;\n  open: boolean;\n}\nconst s: Site = { id: "A1" };`, 5, "`open` isn't optional (no `?`), and the object leaves it out."),
      C("c", "Which would a reviewer prefer?", `function nightsLeft(w: any) {\n  return w.total - w.booked;\n}`, `function nightsLeft(w: { total: number; booked: number }) {\n  return w.total - w.booked;\n}`, "b", "`any` turns checking off, so typos and wrong types slip through. B says exactly what's needed."),
      P("d", "`channel: \"push\" | \"text\"` Which value is allowed?", undefined, ["\"email\"", "\"push\"", "\"Push\"", "\"\""], 1, "Only those exact two words. \"Push\" with a capital P is a different string."),
    ],
    [
      P("a", "Mixed with 1.3, in plain JavaScript. What prints?", `const nights = "2";\nconsole.log(nights + 1);`, ["3", "21", "\"21\"", "An error"], 1, "A string glues. Typing `nights` as a number in TypeScript would have flagged the quotes."),
      P("b", "What does `double(4)` return?", `function double(n: number): number {\n  return n * 2;\n}`, ["4", "8", "\"8\"", "undefined"], 1, "The types don't change what the code does: 4 × 2 is 8."),
      B("c", "Which line would TypeScript flag?", `interface Watch {\n  nights: number;\n}\nfunction total(w: Watch) {\n  return w.nigths * 10;\n}`, 5, "`nigths` is a typo. `Watch` has no such property, so TypeScript catches it. Plain JavaScript would quietly give NaN."),
      P("d", "`const list: string[] = [\"A1\"];` then `list.push(5);` What happens?", undefined, ["It works: push takes anything", "TypeScript flags it: 5 isn't a string", "The list becomes empty", "It throws an error when the app runs"], 1, "`string[]` means a list of strings only."),
    ],
  ],

  /* ───────── 1.11 Reading real code ───────── */
  "p1-real-code": [
    [
      P("a", WHAT, `function openIds(sites) {\n  return sites.filter((s) => s.open).map((s) => s.id);\n}\nconsole.log(openIds([{ id: "A", open: true }, { id: "B", open: false }]).join(","));`, ["A", "B", "A,B", ""], 0, "Only A is open; `map` turns it into its id."),
      P("b", "Edge case. What prints?", `function openIds(sites) {\n  return sites.filter((s) => s.open).map((s) => s.id);\n}\nconsole.log(openIds([]).length);`, ["0", "undefined", "1", "An error"], 0, "An empty list in gives an empty list out, length 0. No crash."),
      B("c", "A 30-foot rig on a 30-foot pad should fit, but `fits(30, 30)` says false. Which line?", `function fits(rig, pad) {\n  return pad > rig;\n}`, 2, "`>` leaves out the exact fit. It should be `>=`."),
      P("d", "No rig length entered. What prints?", `function fits(rig, pad) {\n  if (rig === undefined) {\n    return true;\n  }\n  return pad >= rig;\n}\nconsole.log(fits(undefined, 20));`, ["true", "false", "undefined", "An error"], 0, "The first check catches the missing length and returns true. Whether that's the right call is a question for a review."),
    ],
    [
      P("a", WHAT, `const watches = [{ park: "A", active: false }, { park: "B", active: true }];\nconst w = watches.find((x) => x.active);\nconsole.log(w.park);`, ["A", "B", "undefined", "An error"], 1, "`find` returns the first active watch, B."),
      P("b", "No watches at all. What prints?", `const w = [].find((x) => x.active);\nconsole.log(w === undefined);`, ["true", "false", "undefined", "An error"], 0, "Nothing to find, so `w` is undefined. Reading `w.park` here would crash, which is why callers should check first."),
      T("c", "Trace it.", `function countOpen(sites) {\n  let n = 0;\n  for (const s of sites) {\n    if (s.open) {\n      n = n + 1;\n    }\n  }\n  return n;\n}\nconst a = countOpen([{ open: true }, { open: true }, { open: false }]);`, [{ label: "a", answer: "2" }], "Two of the three are open."),
      C("d", "Both should say whether ANY site is open. Which is right?", `function anyOpen(sites) {\n  return sites.length > 0 && sites[0].open;\n}`, `function anyOpen(sites) {\n  return sites.some((s) => s.open);\n}`, "b", "A only looks at the first site. If site 1 is closed and site 2 is open, it wrongly says no. `some` checks every site."),
    ],
    [
      P("a", "Mixed with 1.4. What prints?", `function label(sitesLeft) {\n  if (sitesLeft === 0) {\n    return "Full";\n  }\n  if (sitesLeft < 5) {\n    return "Almost";\n  }\n  return "Open";\n}\nconsole.log(label(5));`, ["Full", "Almost", "Open", "undefined"], 2, "5 isn't 0 and isn't less than 5, so it reaches the last return. (Exactly 5 is a boundary worth checking.)"),
      T("b", "Mixed with 1.8. What does `best` end as?", `const a = [3, 1, 2];\nlet best = a[0];\nfor (const n of a) {\n  if (n < best) {\n    best = n;\n  }\n}`, [{ label: "best", answer: "1" }], "It keeps the smallest seen so far, starting from the first item."),
      B("c", "Mixed with 1.5. This returns undefined instead of the last site. Which line?", `function lastSite(sites) {\n  return sites[sites.length];\n}`, 2, "`sites.length` is one past the end. It should be `sites[sites.length - 1]`."),
      P("d", "Mixed with 1.9. What prints?", `const sites = [{ id: "A", len: 25 }, { id: "B", len: 40 }];\nconst fit = sites.find((s) => s.len >= 30);\nconsole.log(fit ? fit.id : "none");`, ["A", "B", "none", "undefined"], 1, "B is the first site at least 30 long. (`a ? b : c` means \"if a then b, else c\": a one-line if.)"),
    ],
  ],
};

const NAMES = [
  { title: "Quick check", goal: "Four questions on what this lesson just covered." },
  { title: "Practice", goal: "The same ideas on new examples." },
  { title: "Mixed refresher", goal: "This lesson mixed with earlier ones, so it all sticks." },
] as const;

/** Builds the quiz "lessons" for a lesson: ids `<lesson>--quiz-1` … `-3`, played like any lesson. */
export function quizzesFor(lesson: Lesson): Lesson[] {
  const three = QUIZZES[lesson.id];
  if (!three) return [];
  return three.map((steps, i) => ({
    id: `${lesson.id}--quiz-${i + 1}`,
    number: `${lesson.number} · Quiz ${i + 1}`,
    title: NAMES[i].title,
    goal: NAMES[i].goal,
    minutes: 5,
    quizOf: lesson.id,
    steps,
  }));
}

export const QUIZ_LESSON_IDS: readonly string[] = Object.keys(QUIZZES);
