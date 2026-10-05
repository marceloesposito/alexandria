// Generato da Alexandria
#set document(title: "La memoria dei luoghi", author: ("Autrice \"Prova\"",))
#set page(width: 210mm, height: 297mm, margin: (top: 25mm, bottom: 25mm, inside: 25mm, outside: 25mm), columns: 1)
#set columns(gutter: 8mm)
#set text(font: ("Libertinus Serif", "New Computer Modern"), size: 12pt, lang: "it", hyphenate: true, top-edge: 0.8em, bottom-edge: -0.2em, costs: (widow: 100%, orphan: 100%))
#set par(justify: true, leading: 0.5em, spacing: 0.5em + 0pt, first-line-indent: 0mm)
#set heading(numbering: "1.1")
#set par.line(numbering: "1", number-clearance: 4mm)
#show heading.where(level: 1): set text(size: 20pt, weight: "bold")
#show heading.where(level: 1): set block(above: 22pt, below: 14pt)
#show heading.where(level: 2): set text(size: 15pt, weight: "bold")
#show heading.where(level: 2): set block(above: 18pt, below: 12pt)
#show heading.where(level: 3): set text(size: 13pt, weight: "bold")
#show heading.where(level: 3): set block(above: 16pt, below: 10pt)
#show quote.where(block: true): set text(size: 11pt, weight: "regular")
#show quote.where(block: true): set block(above: 10pt, below: 10pt)
#show figure.caption: set text(size: 10pt, style: "italic")
#show footnote.entry: set text(size: 9.5pt)
#show link: underline

#set page(columns: 1, header: none, footer: none)
#metadata(1) <sec-1>

#align(center)[#heading(level: 1)[#"La memoria dei luoghi"]]

#align(center)[#"Saggio di prova"]

#set page(columns: 1, header: text(size: 9pt, context { if here().page() == locate(<sec-2>).page() { none } else [#"La memoria dei luoghi"#" — "#{ let h = query(heading.where(level: 1).before(here())); if h.len() > 0 { h.last().body } }] }), footer: text(size: 9pt, context [#if calc.odd(here().page()) [#h(1fr)#counter(page).display("1")] else [#counter(page).display("1")#h(1fr)]]))
#counter(page).update(1)
#metadata(2) <sec-2>

#outline(title: [#"Indice"], indent: auto)

#heading(level: 2)[#"Introduzione"]

#"Testo con "#strong[#"grassetto"]#", "#emph[#"corsivo"]#", "#underline[#"sottolineato"]#", "#strike[#"barrato"]#", "#raw("codice")#", "#highlight[#"evidenza"]#", H"#sub[#"2"]#"O, x"#super[#"2"]#" e un "#link("https://example.org")[#"link"]#". Caratteri speciali: # $ * _ @ < > [ ] \\ \"virgolette\" // non un commento."

#"Una citazione "#"(Halbwachs, 1925, p. 12)"#" e una nota"#footnote[#"Nota con "#emph[#"corsivo"]#" e "#"(Halbwachs, 1925)"#"."]#". Formula "#box(baseline: 0.2em, image("math/i7.svg", height: 1em))#" nel testo."

#align(center, block(above: 0.8em, below: 0.8em, image("math/d8.svg", height: 1.2em)))

#quote(block: true)[#"Citazione in blocco."]

#list([#"uno"], [#"due"

#list([#"annidato"])])

#enum(start: 3, [#"tre"], [#"quattro"])

#list(marker: [], [#box(width: 0.75em, height: 0.75em, stroke: 0.5pt) #"da fare"], [#box(width: 0.75em, height: 0.75em, stroke: 0.5pt, inset: 0.05em, align(center + horizon, text(size: 0.7em, sym.checkmark))) #"fatto"])

#table(columns: 2, align: (left, right,), stroke: 0.4pt, inset: 5pt, table.header([#strong[#"A"]], [#strong[#"B"]]), [#"1"], [#"2"])

#block(fill: luma(245), inset: 8pt, radius: 2pt, width: 100%)[#raw(block: true, lang: "js", "const a = \"x\";")]

#figure(image("img/0.svg", width: 50%), caption: [#"Didascalia"], placement: top)

#pagebreak()

#block[
#set par(hanging-indent: 1.5em, first-line-indent: 0em, justify: false)

#heading(level: 2, numbering: none)[#"Bibliografia"]

#"Halbwachs, M. (1925). "#emph[#"Les cadres sociaux de la mémoire"]#"."
]
