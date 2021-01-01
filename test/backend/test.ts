/*
 * This file is released under the MIT license.
 * Copyright (c) 2016, 2020, Mike Lischke
 *
 * See LICENSE file for more info.
 */


import fs = require("fs-extra");
import glob = require("glob");

import { expect, assert } from "chai";
import { AntlrFacade, SymbolKind, RuleMappings } from "../../src/backend/facade";
import { SourceContext } from "../../src/backend/SourceContext";

let backend: AntlrFacade;

interface TestRange {
    source: {
        start: {
            column: number;
            row: number;
        };
        end: {
            column: number;
            row: number;
        };
    };
    target: {
        start: {
            column: number;
            row: number;
        };
        end: {
            column: number;
            row: number;
        };
    };
    result: string;
}

describe("vscode-antlr4-backend:", function () {
    this.slow(10000);

    backend = new AntlrFacade("."); // Search path is cwd for this test.

    describe("Base Handling:", () => {
        it("Create Backend", () => {
            expect(backend, "Test 1").to.be.a("object");

            expect(backend, "Test 2").to.have.property("loadGrammar");
            expect(backend, "Test 3").to.have.property("releaseGrammar");
            expect(backend, "Test 4").to.have.property("reparse");
            expect(backend, "Test 5").to.have.property("infoForSymbol");
            expect(backend, "Test 6").to.have.property("listTopLevelSymbols");
            expect(backend, "Test 7").to.have.property("getDiagnostics");
        });

        let c1: SourceContext;
        it("Load Grammar", () => {
            c1 = backend.loadGrammar("test/backend/t.g4");
            expect(c1, "Test 1").to.be.an.instanceOf(SourceContext);
        });

        it("Unload grammar", () => {
            backend.releaseGrammar("test/backend/t.g4");
            let context = backend.loadGrammar("test/backend/t.g"); // Non-existing grammar.
            expect(context, "Test 1").to.be.an.instanceOf(SourceContext);
            expect(context, "Test 2").to.not.equal(c1);

            backend.releaseGrammar("test/backend/t.g");
            c1 = backend.loadGrammar("test/backend/t.g4");
            context = backend.loadGrammar("test/backend/t.g4");
            expect(context, "Test 3").to.equal(c1);
            backend.releaseGrammar("test/backend/t.g4");
        });
    });

    describe("Symbol Info Retrieval (t.g4):", () => {
        it("infoForSymbol", () => {
            const info = backend.symbolInfoAtPosition("test/backend/t.g4", 7, 2, true);
            assert(info);
            expect(info!.name, "Test 1").to.equal("B");
            expect(info!.source, "Test 2").to.equal("test/backend/t.g4");
            expect(info!.kind, "Test 3").to.equal(SymbolKind.LexerRule);
            assert(info!.definition);
            expect(info!.definition!.text, "Test 4").to.equal("B: 'B';");
            expect(info!.definition!.range.start.column, "Test 5").to.equal(0);
            expect(info!.definition!.range.start.row, "Test 6").to.equal(7);
            expect(info!.definition!.range.end.column, "Test 7").to.equal(6);
            expect(info!.definition!.range.end.row, "Test 8").to.equal(7);
        });

        it("listTopLevelSymbols", () => {
            const symbols = backend.listTopLevelSymbols("test/backend/t.g4", true);
            expect(symbols.length, "Test 1").to.equal(10);

            const info = symbols[8];
            expect(info.name, "Test 2").to.equal("x");
            expect(info.source, "Test 3").to.equal("test/backend/t.g4");
            expect(info.kind, "Test 4").to.equal(SymbolKind.ParserRule);
            expect(info.definition!.text, "Test5").to.equal("x: A | B | C;");
            expect(info.definition!.range.start.column, "Test 6").to.equal(0);
            expect(info.definition!.range.start.row, "Test 7").to.equal(2);
            expect(info.definition!.range.end.column, "Test 8").to.equal(12);
            expect(info.definition!.range.end.row, "Test 9").to.equal(2);
        });

        it("getDiagnostics", () => {
            const diagnostics = backend.getDiagnostics("test/backend/t.g4");
            expect(diagnostics.length, "Test 1").to.equal(2);

            expect(diagnostics[0].message, "Test 2").to.equal("Unknown token reference 'ZZ'");
            expect(diagnostics[0].range.start.column, "Test 3").to.equal(3);
            expect(diagnostics[0].range.start.row, "Test 4").to.equal(3);
            expect(diagnostics[0].range.end.column, "Test 5").to.equal(5);
            expect(diagnostics[0].range.end.row, "Test 6").to.equal(3);

            expect(diagnostics[1].message, "Test 7").to.equal("Unknown channel 'BLAH'");
            expect(diagnostics[1].range.start.column, "Test 8").to.equal(18);
            expect(diagnostics[1].range.start.row, "Test 9").to.equal(8);
            expect(diagnostics[1].range.end.column, "Test 10").to.equal(22);
            expect(diagnostics[1].range.end.row, "Test 11").to.equal(8);
        });

        it("reparse", () => {
            backend.loadGrammar("test/backend/t.g4");
            try {
                backend.setText("test/backend/t.g4", "grammar A; a:: b \n| c; c: b+;");
                backend.reparse("test/backend/t.g4");
                let diagnostics = backend.getDiagnostics("test/backend/t.g4");

                expect(diagnostics.length, "Test 1").to.equal(4);

                expect(diagnostics[0].message, "Test 2").to.equal("mismatched input '::' expecting {BEGIN_ARGUMENT, " +
                    "'options', 'returns', 'locals', 'throws', COLON, AT}");
                expect(diagnostics[0].range.start.column, "Test 3").to.equal(12);
                expect(diagnostics[0].range.start.row, "Test 4").to.equal(1);
                expect(diagnostics[0].range.end.column, "Test 5").to.equal(14);
                expect(diagnostics[0].range.end.row, "Test 6").to.equal(1);

                expect(diagnostics[1].message, "Test 7").to.equal("mismatched input '|' expecting {BEGIN_ARGUMENT, " +
                    "'options', 'returns', 'locals', 'throws', COLON, AT}");
                expect(diagnostics[1].range.start.column, "Test 8").to.equal(0);
                expect(diagnostics[1].range.start.row, "Test 9").to.equal(2);
                expect(diagnostics[1].range.end.column, "Test 10").to.equal(1);
                expect(diagnostics[1].range.end.row, "Test 11").to.equal(2);

                backend.setText("test/backend/t.g4", "grammar A; a: b \n| c; c: b+;");
                backend.reparse("test/backend/t.g4");
                diagnostics = backend.getDiagnostics("test/backend/t.g4");

                expect(diagnostics.length, "Test 12").to.equal(2);

                expect(diagnostics[0].message, "Test 13").to.equal("Unknown parser rule 'b'");
                expect(diagnostics[0].range.start.column, "Test 14").to.equal(14);
                expect(diagnostics[0].range.start.row, "Test 15").to.equal(1);
                expect(diagnostics[0].range.end.column, "Test 16").to.equal(15);
                expect(diagnostics[0].range.end.row, "Test 17").to.equal(1);

                expect(diagnostics[1].message, "Test 18").to.equal("Unknown parser rule 'b'");
                expect(diagnostics[1].range.start.column, "Test 19").to.equal(8);
                expect(diagnostics[1].range.start.row, "Test 20").to.equal(2);
                expect(diagnostics[1].range.end.column, "Test 21").to.equal(9);
                expect(diagnostics[1].range.end.row, "Test 22").to.equal(2);
            } finally {
                backend.releaseGrammar("test/backend/t.g4");
            }
        });
    });

    describe("Symbol Info Retrieval (TParser.g4):", () => {
        it("Symbol Listing", () => {
            backend.loadGrammar("test/backend/TParser.g4");
            const symbols = backend.listTopLevelSymbols("test/backend/TParser.g4", true);
            expect(symbols.length, "Test 1").to.equal(56);

            const info = symbols[38];
            expect(info.name, "Test 2").to.equal("Mode2");
            expect(info.source, "Test 3").to.equal("test/backend/TLexer.g4");
            expect(info.kind, "Test 4").to.equal(SymbolKind.LexerMode);
            assert(info.definition, "Test 5");
            expect(info.definition!.text, "Test 6").to.equal("mode Mode2;");
            expect(info.definition!.range.start.column, "Test 7").to.equal(0);
            expect(info.definition!.range.start.row, "Test 8").to.equal(86);
            expect(info.definition!.range.end.column, "Test 9").to.equal(10);
            expect(info.definition!.range.end.row, "Test 10").to.equal(86);

            let [ruleName] = backend.ruleFromPosition("test/backend/TParser.g4", 37, 103);
            expect(ruleName, "Test 11").to.equal("expr");
            [ruleName] = backend.ruleFromPosition("test/backend/TParser.g4", 100, 123);
            expect(ruleName, "Test 12").to.be.undefined;
            [ruleName] = backend.ruleFromPosition("test/backend/TParser.g4", 2, 119)!;
            expect(ruleName, "Test 13").to.equal("any");
            [ruleName] = backend.ruleFromPosition("test/backend/TParser.g4", 103, 82)!;
            expect(ruleName, "Test 14").to.equal("unused");
            [ruleName] = backend.ruleFromPosition("test/backend/TParser.g4", 64, 68);
            expect(ruleName, "Test 15").to.be.undefined;

            [ruleName] = backend.ruleFromPosition("test/backend/TLexer.g4", 62, 77)!;
            expect(ruleName, "Test 16").to.equal("Comment");
            [ruleName] = backend.ruleFromPosition("test/backend/TLexer.g4", 0, 50)!;
            expect(ruleName, "Test 16").to.equal("ID");
        });

        it("Editing", () => {
            // Change the source. This will release the lexer reference and reload it.
            // If that does not work we'll get a lot of unknown-symbol errors (for all lexer symbols).
            const source = fs.readFileSync("test/backend/TParser.g4", "utf8");
            backend.setText("test/backend/TParser.g4", source + "\nblah: any idarray;");
            backend.reparse("test/backend/TParser.g4");

            const parserDiags = backend.getDiagnostics("test/backend/TParser.g4"); // This also updates the symbol reference counts.
            expect(parserDiags.length, "Test 1").to.be.equal(0);
        });

        it("getDiagnostics", () => {
            const lexerDiags = backend.getDiagnostics("test/backend/TLexer.g4");
            expect(lexerDiags.length, "Test 1").to.be.equal(0);

            let refCount = backend.countReferences("test/backend/TParser.g4", "Semicolon");
            expect(refCount, "Test 2").to.equal(4);

            refCount = backend.countReferences("test/backend/TLexer.g4", "Bar");
            expect(refCount, "Test 3").to.equal(2);
            backend.releaseGrammar("test/backend/TParser.g4");
        });

        it("Symbol ranges", () => {
            let symbol = backend.enclosingSymbolAtPosition("test/backend/TParser.g4", 100, 4); // options {} block
            expect(symbol, "Test 1").not.to.be.undefined;
            expect(symbol!.definition, "Test 2").not.to.be.undefined;
            expect(symbol!.definition!.range.start.row, "Test 3").to.equal(3);
            expect(symbol!.definition!.range.start.column, "Test 4").to.equal(5);
            expect(symbol!.definition!.range.end.row, "Test 5").to.equal(5);
            expect(symbol!.definition!.range.end.column, "Test 6").to.equal(0);

            symbol = backend.enclosingSymbolAtPosition("test/backend/TParser.g4", 9, 34); // action block
            expect(symbol, "Test 10").not.to.be.undefined;
            expect(symbol!.definition, "Test 11").not.to.be.undefined;
            expect(symbol!.definition!.range.start.row, "Test 12").to.equal(30);
            expect(symbol!.definition!.range.start.column, "Test 13").to.equal(17);
            expect(symbol!.definition!.range.end.row, "Test 14").to.equal(37);
            expect(symbol!.definition!.range.end.column, "Test 15").to.equal(0);

            symbol = backend.enclosingSymbolAtPosition("test/backend/TParser.g4", 1000, 1000); // beyond EOF
            expect(symbol, "Test 20").to.be.undefined;

            symbol = backend.enclosingSymbolAtPosition("test/backend/TParser.g4", 79, 82); // argument action block
            expect(symbol, "Test 21").not.to.be.undefined;
            expect(symbol!.definition, "Test 22").not.to.be.undefined;
            expect(symbol!.definition!.range.start.row, "Test 23").to.equal(82);
            expect(symbol!.definition!.range.start.column, "Test 24").to.equal(62);
            expect(symbol!.definition!.range.end.row, "Test 25").to.equal(82);
            expect(symbol!.definition!.range.end.column, "Test 26").to.equal(88);

            symbol = backend.enclosingSymbolAtPosition("test/backend/TParser.g4", 79, 82, true); // same pos, rule context
            expect(symbol, "Test 30").not.to.be.undefined;
            expect(symbol!.definition, "Test 31").not.to.be.undefined;
            expect(symbol!.definition!.range.start.row, "Test 32").to.equal(82);
            expect(symbol!.definition!.range.start.column, "Test 33").to.equal(0);
            expect(symbol!.definition!.range.end.row, "Test 34").to.equal(90);
            expect(symbol!.definition!.range.end.column, "Test 35").to.equal(0);
        });
    });

    describe("Advanced Symbol Information:", () => {

        it("RRD diagram", () => {
            let diagram = backend.getRRDScript("test/backend/TLexer.g4", "Any");
            expect(diagram, "Test 1").to.equal("Diagram(Choice(0, Sequence(Terminal('Foo'), Terminal('Dot'), " +
                "Optional(Terminal('Bar')), Terminal('DotDot'), Terminal('Baz'), Terminal('Bar')))).addTo()");

            diagram = backend.getRRDScript("test/backend/TParser.g4", "idarray");
            expect(diagram, "Test 2").to.equal("ComplexDiagram(Choice(0, Sequence(Terminal('OpenCurly'), " +
                "NonTerminal('id'), ZeroOrMore(Choice(0, Sequence(Terminal('Comma'), NonTerminal('id')))), " +
                "Terminal('CloseCurly')))).addTo()");

            diagram = backend.getRRDScript("test/backend/TParser.g4", "expr");
            expect(diagram, "Test 3").to.equal("ComplexDiagram(Choice(0, Sequence(NonTerminal('expr'), " +
                "Terminal('Star'), NonTerminal('expr'))," +
                " Sequence(NonTerminal('expr'), Terminal('Plus'), NonTerminal('expr')), Sequence(Terminal('OpenPar')," +
                " NonTerminal('expr'), Terminal('ClosePar')), Sequence(Comment('<assoc=right>'), NonTerminal('expr')" +
                ", Terminal('QuestionMark'), NonTerminal('expr'), Terminal('Colon'), NonTerminal('expr')), " +
                "Sequence(Comment('<assoc=right>'), NonTerminal('expr'), Terminal('Equal'), NonTerminal('expr'))," +
                " Sequence(NonTerminal('id')), Sequence(NonTerminal('flowControl')), Sequence(Terminal('INT')), " +
                "Sequence(Terminal('String')))).addTo()",
            );
        });

        it("Reference Graph", () => {
            const graph = backend.getReferenceGraph("test/backend/TParser.g4");
            expect(graph.size, "Test 1").to.equal(48);

            let element = graph.get("TParser.expr");
            expect(element, "Test 2").not.to.be.undefined;
            expect(element!.tokens.size, "Test 3").to.equal(9);
            expect(element!.tokens).contains("TLexer.QuestionMark");

            element = graph.get("TParser.flowControl");
            expect(element, "Test 5").not.to.be.undefined;
            expect(element!.rules.size, "Test 6").to.equal(1);
            expect(element!.tokens.size, "Test 7").to.equal(2);
            expect(element!.literals.size, "Test 8").to.equal(1);
            expect(element!.rules, "Test 9").contains("TParser.expr");
            expect(element!.tokens, "Test 10").contains("TLexer.Continue");
            expect(element!.literals, "Test 11").contains("return");
        });

    });

    describe("ATN Related:", () => {
        it("ATN Rule Graph, split grammar", async () => {
            // Need code generation here. Details will be tested later. The ATN retrieval will fail
            // anyway when generation fails.
            await backend.generate("grammars/ANTLRv4Parser.g4", { outputDir: "generated", language: "Cpp" });

            const graph = backend.getATNGraph("grammars/ANTLRv4Parser.g4", "ruleModifier");

            try {
                expect(graph, "Test 1").not.to.be.undefined;

                expect(graph!.nodes.length, "Test 2").to.equal(4);
                expect(graph!.nodes[0].name, "Test 3").to.equal("56");
                expect(graph!.nodes[0].type, "Test 4").to.equal(2);
                expect(graph!.nodes[1].name, "Test 5").to.equal("57");
                expect(graph!.nodes[1].type, "Test 6").to.equal(7);
                expect(graph!.nodes[2].name, "Test 7").to.equal("364");
                expect(graph!.nodes[2].type, "Test 8").to.equal(1);
                expect(graph!.nodes[3].name, "Test 9").to.equal("365");
                expect(graph!.nodes[3].type, "Test 10").to.equal(1);

                expect(graph!.links.length, "Test 11").to.equal(3);
                expect(graph!.links[0].source, "Test 12").to.equal(0);
                expect(graph!.links[0].target, "Test 13").to.equal(2);
                expect(graph!.links[0].type, "Test 14").to.equal(1);
                expect(graph!.links[0].labels.length, "Test 15").to.equal(1);
                expect(graph!.links[0].labels[0], "Test 16").to.equal("ε");

                expect(graph!.links[1].source, "Test 17").to.equal(2);
                expect(graph!.links[1].target, "Test 18").to.equal(3);
                expect(graph!.links[1].type, "Test 19").to.equal(7);
                expect(graph!.links[1].labels.length, "Test 20").to.equal(4);
                expect(graph!.links[1].labels[3], "Test 21").to.equal("'private'");

                expect(graph!.links[2].source, "Test 22").to.equal(3);
                expect(graph!.links[2].target, "Test 23").to.equal(1);
                expect(graph!.links[2].type, "Test 24").to.equal(1);
                expect(graph!.links[2].labels.length, "Test 25").to.equal(1);
                expect(graph!.links[2].labels[0], "Test 26").to.equal("ε");
            } finally {
                fs.removeSync("generated");
                backend.releaseGrammar("grammars/ANTLRv4Parser.g4");
            }
        }).timeout(20000);
    });

    describe("Code Generation:", () => {
        it("A standard generation run (CSharp), split grammar", async () => {
            const result = await backend.generate("test/backend/TParser.g4",
                { outputDir: "generated", language: "CSharp" });
            expect(result, "Test 1").to.eql(["test/backend/TLexer.g4", "test/backend/TParser.g4"]);

            try {
                expect(fs.existsSync("generated/TLexer.cs"), "Test 2");
                expect(fs.existsSync("generated/TParser.cs"), "Test 3");
                expect(fs.existsSync("generated/TParserBaseListener.cs"), "Test 4");
                expect(fs.existsSync("generated/TParserListener.cs"), "Test 5");
                expect(!fs.existsSync("generated/TParserBaseLVisitor.cs"), "Test 6"); // Not created by default.
                expect(!fs.existsSync("generated/TParserVisitor.cs"), "Test 7"); // ditto

                expect(fs.existsSync("generated/TParser.interp"), "Test 8");
                expect(fs.existsSync("generated/TLexer.interp"), "Test 9");
            } finally {
                backend.releaseGrammar("test/Tbackend/Parser.g4");

                // Don't remove the generated data. Need it for the next test.
            }
        }).timeout(20000);

        it("Load interpreter with existing data, split grammar", async () => {
            expect(fs.existsSync("generated/"), "Test 1");

            let result = await backend.generate("test/backend/TParser.g4", {
                outputDir: "generated", language: "CSharp", loadOnly: true,
            });

            // No dependencies are returned since data is only loaded, not generated.
            expect(result, "Test 2").to.eql([]);

            // Only for combined grammars is the lexer data stored in the main context.
            const temp = backend.getATNGraph("test/backend/TLexer.g4", "Dollar");
            expect(temp, "Test 3").to.be.undefined;

            // Now load the lexer data too.
            result = await backend.generate("test/backend/TLexer.g4", {
                outputDir: "generated", language: "CSharp", loadOnly: true,
            });

            const dollarGraph = backend.getATNGraph("test/backend/TLexer.g4", "Dollar");
            const statGraph = backend.getATNGraph("test/backend/TParser.g4", "stat");

            try {
                expect(dollarGraph, "Test 4").not.to.be.undefined;

                expect(dollarGraph!.nodes.length, "Test 5").to.equal(7);
                expect(dollarGraph!.nodes[0].name, "Test 6").to.equal("45");
                expect(dollarGraph!.nodes[0].type, "Test 7").to.equal(2);
                expect(dollarGraph!.nodes[2].name, "Test 8").to.equal("140");
                expect(dollarGraph!.nodes[2].type, "Test 9").to.equal(1);
                expect(dollarGraph!.nodes[5].name, "Test 10").to.equal("143");
                expect(dollarGraph!.nodes[5].type, "Test 11").to.equal(1);
                expect(dollarGraph!.nodes[6].name, "Test 12").to.equal("144");
                expect(dollarGraph!.nodes[6].type, "Test 13").to.equal(1);

                expect(dollarGraph!.links.length, "Test 14").to.equal(6);
                expect(dollarGraph!.links[1].source, "Test 15").to.equal(2);
                expect(dollarGraph!.links[1].target, "Test 16").to.equal(3);
                expect(dollarGraph!.links[1].type, "Test 17").to.equal(5);
                expect(dollarGraph!.links[1].labels.length, "Test 18").to.equal(1);
                expect(dollarGraph!.links[1].labels[0], "Test 19").to.equal("'$'");

                expect(dollarGraph!.links[2].source, "Test 20").to.equal(3);
                expect(dollarGraph!.links[2].target, "Test 21").to.equal(4);
                expect(dollarGraph!.links[2].type, "Test 22").to.equal(1);
                expect(dollarGraph!.links[2].labels.length, "Test 232").to.equal(1);
                expect(dollarGraph!.links[2].labels[0], "Test 24").to.equal("ε");

                expect(dollarGraph!.links[5].source, "Test 25").to.equal(6);
                expect(dollarGraph!.links[5].target, "Test 26").to.equal(1);
                expect(dollarGraph!.links[5].type, "Test 27").to.equal(1);
                expect(dollarGraph!.links[5].labels.length, "Test 28").to.equal(1);
                expect(dollarGraph!.links[5].labels[0], "Test 29").to.equal("ε");

                expect(statGraph, "Test 30").not.to.be.undefined;
                expect(statGraph!.nodes.length, "Test 31").to.equal(15);
                expect(statGraph!.nodes[0].id.toString(), "Test 32").to.equal(statGraph!.nodes[0].name);
                expect(statGraph!.nodes[0].name, "Test 32").to.equal("12");
                expect(statGraph!.nodes[0].type, "Test 33").to.equal(2);
                expect(statGraph!.nodes[7].id.toString(), "Test 34").to.equal(statGraph!.nodes[7].name);
                expect(statGraph!.nodes[7].name, "Test 34").to.equal("82");
                expect(statGraph!.nodes[7].type, "Test 35").to.equal(1);
                expect(statGraph!.nodes[11].name, "Test 36").to.equal("85");
                expect(statGraph!.nodes[11].type, "Test 37").to.equal(1);
                expect(statGraph!.nodes[14].name, "Test 38").to.equal("88");
                expect(statGraph!.nodes[14].type, "Test 39").to.equal(8);
                expect(statGraph!.nodes[3].name, "Test 38").to.equal("expr");
                expect(statGraph!.nodes[3].id, "Test 39").to.equal(-1);
                expect(statGraph!.nodes[6].name, "Test 38").to.equal("expr");
                expect(statGraph!.nodes[6].id, "Test 39").to.equal(-2);
                expect(statGraph!.nodes[10].name, "Test 38").to.equal("expr");
                expect(statGraph!.nodes[10].id, "Test 39").to.equal(-3);

                expect(statGraph!.links.length, "Test 40").to.equal(15);
                expect(statGraph!.links[1].source, "Test 41").to.equal(13);
                expect(statGraph!.links[1].target, "Test 42").to.equal(2);
                expect(statGraph!.links[1].type, "Test 43").to.equal(1);
                expect(statGraph!.links[1].labels.length, "Test 44").to.equal(1);
                expect(statGraph!.links[1].labels[0], "Test 45").to.equal("ε");

                expect(statGraph!.links[4].source, "Test46").to.equal(3);
                expect(statGraph!.links[4].target, "Test 47").to.equal(4);
                expect(statGraph!.links[4].type, "Test 48").to.equal(3);
                expect(statGraph!.links[4].labels.length, "Test 49").to.equal(1);
                expect(statGraph!.links[4].labels[0], "Test 50").to.equal("ε");

                expect(statGraph!.links[12].source, "Test 51").to.equal(7);
                expect(statGraph!.links[12].target, "Test 52").to.equal(8);
                expect(statGraph!.links[12].type, "Test 53").to.equal(5);
                expect(statGraph!.links[12].labels.length, "Test 54").to.equal(1);
                expect(statGraph!.links[12].labels[0], "Test 55").to.equal("';'");
            } finally {
                backend.releaseGrammar("test/backend/TParser.g4");
                backend.releaseGrammar("test/backend/TLexer.g4");
                fs.removeSync("generated");
            }
        }).timeout(20000);

        it("Interpreter load w/o existing data, split grammar", async () => {
            const result = await backend.generate("test/backend/TParser.g4",
                { outputDir: "generated", language: "CSharp", loadOnly: true });
            expect(result, "Test 1").to.eql([]);
            expect(!fs.existsSync("generated/"), "Test 2");

            const graph = backend.getATNGraph("test/backend/TParser.g4", "stat");
            expect(graph, "Test 3").to.be.undefined;
        }).timeout(20000);

        it("A generation run with settings, split grammar (typescript, cpp)", async () => {
            // The typescript target requires a different tool jar.
            // TODO: currently we have to create the lib folder manually (until a pending path handling patch is included in ANTLR).
            fs.ensureDirSync("generated/typescript");

            let result = await backend.generate("test/backend/TParser.g4", {
                baseDir: __dirname + "/../../..",
                libDir: "generated/typescript",
                outputDir: "generated",
                language: "typescript",
                package: "parser",
                listeners: false,
                visitors: true,
            });
            expect(result, "Test 1").to.eql(["test/backend/TLexer.g4", "test/backend/TParser.g4"]);

            // The same grammar for the C++ target.
            fs.ensureDirSync("generated/cpp");
            result = await backend.generate("test/backend/TParser.g4", {
                baseDir: __dirname + "/../../..",
                libDir: "generated/cpp",
                outputDir: "generated",
                language: "Cpp",
                package: "parser",
                listeners: false,
                visitors: true,
            });
            expect(result, "Test 1").to.eql(["test/backend/TLexer.g4", "test/backend/TParser.g4"]);

            try {
                expect(fs.existsSync("generated/typescript/TLexer.ts"), "Test 2");
                expect(fs.existsSync("generated/typescript/TParser.ts"), "Test 3");
                expect(!fs.existsSync("generated/typescript/TParserBaseListener.ts"), "Test 4");
                expect(!fs.existsSync("generated/typescript/TParserListener.ts"), "Test 5");
                expect(fs.existsSync("generated/typescript/TParserBaseLVisitor.ts"), "Test 6");
                expect(fs.existsSync("generated/typescript/TParserVisitor.ts"), "Test 7");
            } finally {
                fs.removeSync("generated");
            }
        }).timeout(20000);

        it("Generation with semantic error, combined grammar (C++)", async () => {
            try {
                // File contains left recursive rule which are detected only by the ANTLR.
                // Hence we need a generation run to report them.
                const parserDiags = backend.getDiagnostics("test/backend/t2.g4");
                expect(parserDiags.length, "Test 1").to.be.equal(0); // No error here yet.

                await backend.generate("test/backend/t2.g4", {
                    outputDir: "generated", language: "Cpp", package: "parser", listeners: false, visitors: true,
                });
                expect(parserDiags.length, "Test 2").to.be.equal(3);
            } finally {
                backend.releaseGrammar("test/backend/t2.g4");
                fs.removeSync("generated");
            }
        }).timeout(20000);

        it("Generation with Java exception, combined grammar (Java)", async () => {
            // Testing a grammar with an awful lot of (implicit) lexer tokens.
            // Crashes ANTLR and we need to report that separately.
            try {
                await backend.generate("test/backend/OddExpr.g4", {
                    outputDir: "generated", language: "Java", package: "parser", listeners: false, visitors: true,
                });
            } catch (error) {
                expect(error, "Test 1").to.contain("java.lang.UnsupportedOperationException: Serialized ATN data " +
                    "element 101246 element 11 out of range 0..65535");
            } finally {
                backend.releaseGrammar("test/backend/t2.g4");
                fs.removeSync("generated");
            }
        }).timeout(20000);

        it("Generation with errors, split grammar (C++)", async () => {
            try {
                // Asking for parser generation, getting lexer error back.
                const result = await backend.generate("test/backend/TParser2.g4", {
                    outputDir: "generated", language: "Cpp", package: "parser", listeners: false, visitors: false,
                });
                expect(result, "Test 1").to.be.eql(["test/backend/TLexer2.g4", "test/backend/TParser2.g4"]);
                const diagnostics = backend.getDiagnostics("test/backend/TLexer2.g4");
                expect(diagnostics.length, "Test 2").to.equal(1);
                expect(diagnostics[0].message, "Test 3")
                    .to.equal("cannot find tokens file test/backend/nonexisting.tokens");
            } finally {
                backend.releaseGrammar("test/backend/TParser2.g4");
                backend.releaseGrammar("test/backend/TLexer2.g4");
                fs.removeSync("generated");
            }
        }).timeout(20000);
    });

    describe("Test for Bugs:", () => {
        it("Lexer token in a set-element context", () => {
            const info = backend.symbolInfoAtPosition("test/backend/TParser.g4", 48, 93, true);
            assert(info, "Test 1");
            expect(info!.name, "Test 2").to.equal("Semicolon");
            expect(info!.source, "Test 3").to.equal("test/backend/TLexer.g4");
            expect(info!.kind, "Test 4").to.equal(SymbolKind.LexerRule);
            assert(info!.definition, "Test 5");
            expect(info!.definition!.text, "Test 6").to.equal("Semicolon: ';';");
            expect(info!.definition!.range.start.column, "Test 7").to.equal(0);
            expect(info!.definition!.range.start.row, "Test 8").to.equal(59);
            expect(info!.definition!.range.end.column, "Test 9").to.equal(14);
            expect(info!.definition!.range.end.row, "Test 10").to.equal(59);

            backend.releaseGrammar("test/backend/TParser.g4");
            const selfDiags = backend.getSelfDiagnostics();
            expect(selfDiags.contextCount, "Test 11").to.equal(0);
        });
    });

    // TODO: sentence generation is not ready yet.
    // Due to the nature of language definition by rules, we often generate invalid content.
    // This need investigation.
    xdescribe("Sentence Generation:", () => {
        before(async () => {
            this.timeout(10000);
            let result = await backend.generate("grammars/ANTLRv4Parser.g4",
                { outputDir: "generated", language: "CSharp" });
            for (const file of result) {
                const diagnostics = backend.getDiagnostics(file);
                if (diagnostics.length > 0) {
                    console.log("Generation error: " + diagnostics[0].message);
                }
                expect(diagnostics.length, "Test 1").to.equal(0);
            }

            // The ANTLR4 grammar is a split grammar, so we have to explicitly load the other parts we need here.
            result = await backend.generate("grammars/ANTLRv4Lexer.g4", { outputDir: "generated", loadOnly: true });
            result = await backend.generate("grammars/ANTLRv4LexBasic.g4", { outputDir: "generated", loadOnly: true });

            result = await backend.generate("test/backend/sentences.g4", { outputDir: "generated", language: "Java" });
            for (const file of result) {
                const diagnostics = backend.getDiagnostics(file);
                if (diagnostics.length > 0) {
                    console.log("Generation error: " + diagnostics[0].message);
                }
                expect(diagnostics.length, "Test 2").to.equal(0);
            }
        });

        // Sentence generation is random for variable parts and it happens pretty frequently that generated
        // sentences are ambiguous. Hence we only test that such generated content can be parsed error free.
        it("Simple lexer sentence generation", () => {
            // A grammar made specifically for sentence generation.
            const tester = (sentence: string) => {
                //console.log(symbolicName + ": " + sentence);
                const [error] = backend.lexTestInput("test/backend/sentences.g4", sentence);
                expect(error).to.be.empty;
            };

            const vocabulary = backend.getLexerVocabulary("test/backend/sentences.g4")!;
            for (let i = 1; i <= vocabulary.maxTokenType; ++i) {
                const symbolicName = vocabulary.getSymbolicName(i);
                backend.generateSentence("test/backend/sentences.g4", symbolicName!, {
                    maxLexerIterations: 15,
                    maxParserIterations: 15,
                }, tester);
            }
        });

        it("ANTLR4 lexer sentence generation", () => {
            const lexerTokens = [
                "DOC_COMMENT",
                "BLOCK_COMMENT",
                "LINE_COMMENT",
                "INT",
                "STRING_LITERAL",
                "OPTIONS",
                "CHANNELS",
                "RBRACE",
                "PLUS_ASSIGN",
                "ID",
            ];

            const tester = (sentence: string) => {
                //console.log(token + ": " + sentence);
                expect(sentence.length, "Empty sentence generated").to.be.greaterThan(0);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [_, error] = backend.lexTestInput("grammars/ANTLRv4Lexer.g4", sentence);
                expect(error).to.be.empty;

            };

            for (const token of lexerTokens) {
                backend.generateSentence("grammars/ANTLRv4Lexer.g4", token, {
                    count: 5,
                    maxLexerIterations: 10,
                    maxParserIterations: 10,
                }, tester);
            }
        });

        it("Parser sentence generation", () => {
            this.slow(30000);
            this.timeout(60000);

            const tester = (rule: string, sentence: string) => {
                //console.log(rule + ": " + sentence);
                const errors = backend.parseTestInput("test/backend/sentences.g4", sentence, rule);
                if (errors.length > 0) {
                    console.log("errors:");
                    for (const error of errors) {
                        console.log("\t" + error + "\n");
                    }
                }
                expect(errors.length, "Test 5").to.equal(0);

            };

            const rules = backend.getRuleList("test/backend/sentences.g4")!;
            for (const rule of rules) {
                backend.generateSentence("test/backend/sentences.g4", rule, {
                    count: 100,
                    minLexerIterations: 3,
                    maxLexerIterations: 10,
                    minParserIterations: 0,
                    maxParserIterations: 3,
                }, tester.bind(this, rule));
            }
        });

        it("Generation with definitions", () => {
            this.slow(30000);
            this.timeout(60000);

            const ruleMappings: RuleMappings = new Map([
                ["DIGITS", "12345"],
                ["SimpleIdentifier", "Mike"],
                ["UnicodeIdentifier", "µπåƒ"],
            ]);

            const tester = (rule: string, sentence: string) => {
                //console.log(rule + ": " + sentence);
                const errors = backend.parseTestInput("test/backend/sentences.g4", sentence, rule);
                if (errors.length > 0) {
                    console.log("errors:");
                    for (const error of errors) {
                        console.log("\t" + error + "\n");
                    }
                }
                expect(errors.length, "Test 1").to.equal(0);

                // In addition to error free generation check also that only known elements are in the sentence.
                sentence = sentence.replace(/12345/g, "");
                sentence = sentence.replace(/DEADBEEF/g, "");
                sentence = sentence.replace(/Mike/g, "");
                sentence = sentence.replace(/µπåƒ/g, "");
                sentence = sentence.replace(/red/g, "");
                sentence = sentence.replace(/green/g, "");
                sentence = sentence.replace(/blue/g, "");
                sentence = sentence.replace(/[0-9{},.:]/g, "");
                sentence = sentence.trim();
                //console.log(rule + ": " + sentence);
                expect(sentence.length, "Test 2").to.equal(0);
            };

            const rules = backend.getRuleList("test/backend/sentences.g4")!;
            for (const rule of rules) {
                backend.generateSentence("test/backend/sentences.g4", rule, {
                    count: 10,
                    maxLexerIterations: 7,
                    maxParserIterations: 7,
                    ruleMappings,
                }, tester.bind(this, rule));
            }
        });

        after(() => {
            backend.releaseGrammar("test/backend/sentences.g4");
            backend.releaseGrammar("test/backend/CPP14.g4");
            fs.removeSync("generated");
        });
    });

    describe("Formatting:", () => {
        it("With all options (except alignment)", () => {
            // Format a file with all kinds of syntactic elements. Start out with default
            // formatting options and change them in the file to test all variations.
            const [text] = backend.formatGrammar("test/backend/formatting/raw.g4", {}, 0, 1e10);

            //fs.writeFileSync("test/backend/formatting-results/raw2.g4", text, "utf8");
            const expected = fs.readFileSync("test/backend/formatting-results/raw.g4", { encoding: "utf8" });
            expect(expected).to.equal(text);
        });

        it("Alignment formatting", () => {
            this.slow(20000);

            //createAlignmentGrammar();

            // Load a large file with all possible alignment combinations (50 rules for each permutation),
            // checking so also the overall performance (9600 rules).
            const [text] = backend.formatGrammar("test/backend/formatting/alignment.g4", {}, 0, 1e10);

            //fs.writeFileSync("test/backend/formatting-results/alignment.g4", text, "utf8");
            const expected = fs.readFileSync("test/backend/formatting-results/alignment.g4", { encoding: "utf8" });
            expect(expected).to.equal(text);
        }).timeout(30000);

        it("Ranged formatting", () => {
            let [text, targetStart, targetStop] = backend.formatGrammar("test/backend/formatting/raw.g4", {}, -10, -20);
            expect(text.length, "Test 0a").to.equal(0);
            expect(targetStart, "Test 0b").to.equal(0);
            expect(targetStop, "Test 0c").to.equal(4);

            const rangeTests = JSON.parse(fs.readFileSync("test/backend/formatting/ranges.json",
                { encoding: "utf8" })) as TestRange[];
            const source = fs.readFileSync("test/backend/formatting/raw.g4", { encoding: "utf8" });
            for (let i = 1; i <= rangeTests.length; ++i) {
                const rangeTest = rangeTests[i - 1];

                // Range ends are non-inclusive.
                const startIndex = positionToIndex(source, rangeTest.source.start.column, rangeTest.source.start.row);
                const stopIndex = positionToIndex(source, rangeTest.source.end.column, rangeTest.source.end.row) - 1;
                [text, targetStart, targetStop] = backend.formatGrammar("test/backend/formatting/raw.g4", {},
                    startIndex, stopIndex);

                const [startColumn, startRow] = indexToPosition(source, targetStart);
                const [stopColumn, stopRow] = indexToPosition(source, targetStop + 1);
                const range = {
                    start: { column: startColumn, row: startRow }, end: { column: stopColumn, row: stopRow },
                };

                //fs.writeFileSync("test/backend/formatting-results/" + rangeTest.result, text, "utf8");
                const expected = fs.readFileSync("test/backend/formatting-results/" + rangeTest.result,
                    { encoding: "utf8" });
                expect(range, "Range Test " + i + "a").to.deep.equal(rangeTest.target);
                expect(expected, "Test " + i + "b").to.equal(text);
            }
        });

        // This test has been taken out by intention as it is difficult to get good results for all grammars
        // with the same set of settings. Consider it more like a smoke test.
        // For running it you must copy the ANTLR4 grammar directory into "test/backend/formatting/grammars-v4"
        // (or adjust the path in this test).
        xit("ANTLR grammar directory", () => {
            const files = glob.sync("test/backend/formatting/grammars-v4/**/*.g4", {});
            for (const file of files) {
                const [text] = backend.formatGrammar(file, {
                    useTab: false,
                    tabWidth: 4,
                    spaceBeforeAssignmentOperators: true,
                    columnLimit: 120,
                    allowShortRulesOnASingleLine: true,
                    alignColons: "hanging",
                    singleLineOverrulesHangingColon: false,
                    alignTrailingComments: true,
                    alignLexerCommands: true,
                }, 0, 100000);
                const output = file.replace("formatting/", "formatting-results/");

                //fs.ensureDirSync(path.dirname(output));
                //fs.writeFileSync(output, text, "utf8");
                const expected = fs.readFileSync(output, { encoding: "utf8" });
                expect(expected, "Test 1").to.equal(text);
            }
        }).timeout(20000);
    });

    describe("Debugger:", () => {
        it("Run interpreter", async () => {
            await backend.generate("test/backend/CPP14.g4", { outputDir: "generated", language: "Java" });
            try {
                const code = fs.readFileSync("test/backend/code.cpp", { encoding: "utf8" });
                const d = backend.createDebugger("test/backend/CPP14.g4", "", "generated");
                expect(d, "Test 1").not.to.be.undefined;
                d!.start(0, code, false);
                //const tree = d!.currentParseTree;
                //console.log(util.inspect(tree, false, null, true));

                // TODO: test step-in/out/over/ as well as breakpoints.
            } finally {
                backend.releaseGrammar("test/backend/CPP14.g4");
                fs.removeSync("generated");
            }
        }).timeout(20000);
    });
});

/**
 * Generates the alignment.g4 grammar from formatting options in the alignment-template.g4 file.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createAlignmentGrammar = (): void => {
    let grammar = "grammar alignment;\n\n// $antlr-format reset, columnLimit 200\n";
    const template = fs.readFileSync("test/backend/formatting/alignment-template.g4", { encoding: "utf8" });
    const sections = template.split("\n");

    // For each section create 100 rules with some random parts.
    for (const section of sections) {
        grammar += "\n" + section + "\n";

        // Make it 30 lexer rules and 20 parser rules (less parser rules as we always use grouped alignments for them).
        for (let i = 0; i < 30; ++i) {
            if (i === 0) {
                grammar += "// $antlr-format groupedAlignments off\n";
            } else if (i === 15) {
                grammar += "// $antlr-format groupedAlignments on\n";
            }

            const ruleNameFillCount = Math.random() * 25 + 1;
            const useLexerAction = Math.random() < 0.5;
            const useComment = Math.random() < 0.5;
            const usePredicate = Math.random() < 0.5;
            const useAction = Math.random() < 0.5;

            const filler = "_".repeat(ruleNameFillCount);
            let line = "Keyword" + filler + i + ":'Keyword" + filler + i + "'";

            if (useAction) {
                if (usePredicate) {
                    // Both, action and predicate. Make order random too.
                    if (Math.random() < 0.5) {
                        line += "{domeSomething($text);} ";
                        line += "{doesItBlend()}? ";
                    } else {
                        line += "{doesItBlend()}? ";
                        line += "{domeSomething($text);} ";
                    }
                } else {
                    line += "{domeSomething($text);} ";
                }
            } else if (usePredicate) {
                line += "{doesItBlend()}? ";
            }

            if (useLexerAction) {
                const type = Math.random() < 0.5 ? "mode" : "type";
                line += "-> " + type + "(SomethingReallyMeaningful) ";
            }

            line += ";";
            if (useComment) {
                line += " // Specified in the interest of formatting.";
            }

            grammar += line + "\n";
        }

        grammar += "// $antlr-format groupedAlignments on\n";
        for (let i = 0; i < 20; ++i) {
            if (i === 0) {
                grammar += "// $antlr-format allowShortRulesOnASingleLine false, allowShortBlocksOnASingleLine false\n";
            } else if (i === 10) {
                grammar += "// $antlr-format allowShortRulesOnASingleLine true, allowShortBlocksOnASingleLine true\n";
            }

            const ruleNameFillCount = Math.random() * 25 + 1;
            const useComment = Math.random() < 0.25;
            const action = Math.random() < 0.25 ? "{doSomething($text);}" : " ";
            const predicate = Math.random() < 0.25 ? "{doesItBlend}?" : " ";
            const useLabels = Math.random() < 0.5;

            let line = "rule" + "_".repeat(ruleNameFillCount) + i + ": (";

            if (useComment) {
                line += predicate + "alt1" + action + "ruleA// Mom look, a trailing comment.\n";
                line += "|" + predicate + "____alt2" + action + "ruleB// And another comment.\n";
                line += "|" + predicate + "____alt3" + action + "ruleB/* Not aligned comment.*/\n";
            } else {
                line += predicate + "alt1" + action + "ruleA|____alt2" + action + "ruleB";
            }
            line += ")";

            if (!useLabels) {
                line += "rule_ | rule__ | rule____ | rule________ ";
            } else {
                line += "rule_ # label_ | rule__ # label__ | rule____ #label____| rule________#label________ ";
            }

            line += action + predicate + ";";
            if (useComment) {
                line += " // Final trailing comment.";
            }

            grammar += line + "\n";
        }
    }

    fs.writeFileSync("test/backend/formatting/alignment.g4", grammar, "utf8");
};

/**
 * Converts the given position in the text to a character index (assuming 4 chars tab width).
 *
 * @param text The text for which to convert the position.
 * @param column The position in the text line.
 * @param row The line in the text.
 *
 * @returns The character index in the text for the given position.
 */
const positionToIndex = (text: string, column: number, row: number): number => {
    let currentRow = 1; // Remember: row numbers in ANTLR4 are one-based.
    let currentColumn = 0;

    for (let i = 0; i < text.length; ++i) {
        if (row < currentRow) { // Happens when the column value was greater than previous column width.
            return i - 1;
        }

        if (currentRow === row && currentColumn === column) {
            return i;
        }
        switch (text[i]) {
            case "\n": {
                currentColumn = 0;
                ++currentRow;
                break;
            }
            case "\t": {
                currentColumn += 4 - (currentColumn % 4);
                break;
            }
            default:
                ++currentColumn;
                break;
        }
    }

    return text.length;
};

/**
 * Converts the given character index into a column/row pair (assuming 4 chars tab width).
 *
 * @param text The text for which to convert the index.
 * @param index The character index in the text.
 *
 * @returns A [column, row] tuple with the position of the given index.
 */
const indexToPosition = (text: string, index: number): [number, number] => {
    let currentRow = 1;
    let currentColumn = 0;
    for (let i = 0; i < text.length; ++i) {
        if (i === index) {
            return [currentColumn, currentRow];
        }
        switch (text[i]) {
            case "\n": {
                currentColumn = 0;
                ++currentRow;
                break;
            }
            case "\t": {
                currentColumn += 4 - (currentColumn % 4);
                break;
            }
            default:
                ++currentColumn;
                break;
        }
    }

    return [currentColumn, currentRow];
};
