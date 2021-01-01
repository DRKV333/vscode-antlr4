/*
 * This file is released under the MIT license.
 * Copyright (c) 2016, 2020, Mike Lischke
 *
 * See LICENSE file for more info.
 */

import * as fs from "fs";
import * as path from "path";

import { ATNStateType, TransitionType } from "antlr4ts/atn";
import { Vocabulary } from "antlr4ts";

export enum SymbolGroupKind { // Multiple symbol kinds can be involved in a symbol lookup.
    TokenRef,
    RuleRef,
    LexerMode,
    TokenChannel,
}

export enum SymbolKind {
    Keyword,
    TokenVocab,
    Import,
    BuiltInLexerToken,
    VirtualLexerToken,
    FragmentLexerToken,
    LexerRule,
    BuiltInMode,
    LexerMode,
    BuiltInChannel,
    TokenChannel,
    ParserRule,
    Action,
    Predicate,
    Operator,
    Option,
    TokenReference,
    RuleReference
}

// Import modules that depend on these enums after their definition, to allow for static initializations.
import { SourceContext, GrammarType } from "./SourceContext";
import { GrammarDebugger } from "./GrammarDebugger";

/**
 * A range within a text. Just like the range object in vscode the end position is not included in the range.
 * Hence when start and end position are equal the range is empty.
 */
export interface LexicalRange {
    start: { column: number; row: number };
    end: { column: number; row: number };
}

// The definition of a single symbol (range and content it is made of).
export interface Definition {
    text: string;
    range: LexicalRange;
}

export interface SymbolInfo {
    kind: SymbolKind;
    name: string;
    source: string;
    definition?: Definition;
    description?: string;  // Used for code completion. Provides a small description for certain symbols.
    isPredicate?: boolean; // Used only for actions.
}

export enum DiagnosticType {
    Hint,
    Info,
    Warning,
    Error
}

export interface DiagnosticEntry {
    type: DiagnosticType;
    message: string;
    range: LexicalRange;
}

/**
 * Contains a number of values for a lexer token. Used when constructing a token list and parse trees in the debugger.
 */
export interface LexerToken {
    [key: string]: string | number | object;

    text: string;
    type: number;
    name: string;
    line: number;
    offset: number; // Offset in the line.
    channel: number;
    tokenIndex: number;
    startIndex: number;
    stopIndex: number;
}

export enum ParseTreeNodeType {
    Rule,
    Terminal,
    Error
}

/**
 * Describes the a range in an input stream (character indexes in a char stream or token indexes in a token stream).
 * Indexes can be < 0 if there's no input representation for a tree node (e.g. when it did not match anything).
 */
export interface IndexRange {
    startIndex: number;
    stopIndex: number;
    length: number;
}

/**
 * This node class is what exported parse trees are made of, which are created by the debugger interface.
 * Each node stands either for an invoked rule, a terminal node or an error node.
 */
export interface ParseTreeNode {
    type: ParseTreeNodeType;
    id: number;          // A unique id to allow computing differences when updating a parse tree visualization in D3.js.

    ruleIndex?: number;  // Only valid for the rule node type.
    name: string;
    start?: LexerToken;  // ditto
    stop?: LexerToken;   // ditto
    range?: IndexRange;   // ditto

    symbol?: LexerToken; // Only valid for non-rule nodes.

    children: ParseTreeNode[]; // Available for all node types, but empty for non-rule types.
}

/**
 * All references of a rule (both lexer and parser) to other rules and string literals.
 * Lexer rules obviously cannot have any parser rule reference. String literals are mostly interesting
 * for parser rules to check for implicit lexer tokens.
 */
export interface ReferenceNode {
    kind: SymbolKind;
    rules: Set<string>;
    tokens: Set<string>;
    literals: Set<string>;
}

export interface ATNNode {
    id: number;         // A unique number (positive for state numbers, negative for rule nodes)
    name: string;
    type: ATNStateType;

    // Cached position values.
    fx?: number;
    fy?: number;
}

export interface ATNLink {
    source: number;
    target: number;
    type: TransitionType;
    labels: string[];
}

/**
 * Contains the link + node values which describe the ATN graph for a single rule.
 */
export interface ATNGraphData {
    nodes: ATNNode[];
    links: ATNLink[];
}

/**
 * Options used by the parser files generation.
 */
export interface GenerationOptions {
    baseDir?: string;    // The folder in which to run the generation process.
    // Should be an absolute path for predictable results. Used internally only.
    libDir?: string;     // Search path for the ANTLR tool.
    outputDir?: string;  // The folder where to place generated files in (relative to baseDir or absolute). (default: grammar dir)
    package?: string;    // Package or namespace name for generated files. (default: none)
    language?: string;   // The target language for the generated files. (default: what's given in the grammar or Java)
    listeners?: boolean; // Generate listener files if set. (default: true)
    visitors?: boolean;  // Generate visitor files if set. (default: false)
    loadOnly?: boolean;  // Don't generate anything. Just try to load interpreter data and do interpreter setup.
    alternativeJar?: string;        // Use this jar for work instead of the built-in one(s).
    additionalParameters?: string;  // Any additional parameter you want to send to ANTLR4 for generation (e.g. "-XdbgST").
}

/**
 * Options used by the sentence generation.
 */
export interface SentenceGenerationOptions {
    /**
     * The number of sentences to generate in one call.
     */
    count?: number;

    /**
     * Clear output on each run (used for output printing in the UI).
     */
    clear?: boolean;

    /**
     * Determines how quick the weight for a decision to be select converges towards 0 (between 0 and 1, default: 0.25).
     * Each time a decision is taken its weight will decrease. The lower the weight is, compared to other decisions from
     * a particular decision state, the less likely will it be selected.
     */
    convergenceFactor?: number;

    /**
     * The minimum number of iterations used for `+` and `*` loops in the parser (default: 1 for `+`, 0 for `*`).
     * Must be a positive integer (or 0) and must be smaller than maxParserIterations (if that is given).
     * If set to 0 then for `+` loops 1 is used, automatically.
     */
    minParserIterations?: number;

    /**
     * The maximum number of iterations in the parser. Must be a number > 0 and > minParserIterations.
     * If that is not the case or the value is not specified then it is set to minParserIterations + 1.
     */
    maxParserIterations?: number;

    /**
     * The minimum number of iterations in the lexer (default: 1 for `+`, 0 for `*`).
     * Must be a positive integer (or 0) and must be smaller than maxLexerIterations (if that is given).
     * If set to 0 then for `+` loops 1 is used, automatically.
     */
    minLexerIterations?: number;

    /**
     * The maximum number of iterations in the lexer. Must be a number > 0 and > than minLexerIterations.
     * If that is not the case or the value is not specified then it is set to minLexerIterations + 10.
     */
    maxLexerIterations?: number;

    /**
     * The maximum number of recursions (rules calling themselves directly or indirectly, default: 3).
     */
    maxRecursions?: number;

    /**
     * A mapping of rule names to string literals, which should be used instead of running the generation for that rule.
     */
    ruleMappings?: Map<string, string>;

    /**
     * The name of a file which contains code to evaluate grammar actions and predicates.
     */
    actionFile?: string;
}

/**
 * Mappings from rule names to strings, which define output to use for specific rules when generating sentences.
 */
export type RuleMappings = Map<string, string>;

/**
 * Options for grammar text formatting. Some names, values and meanings have been taken from clang-format
 * (http://clang.llvm.org/docs/ClangFormatStyleOptions.html), but may have slight variations tailored towards ANTLR grammars.
 * Deviations from that are mentioned in comments, otherwise see clang-format and the documentation for descriptions + examples.
 */
export interface FormattingOptions {
    // Index signature to allow accessing properties via brackets.
    [key: string]: boolean | number | string | undefined;

    alignTrailingComments?: boolean;            // Default: false
    allowShortBlocksOnASingleLine?: boolean;    // Default: true;
    breakBeforeBraces?: boolean;                // When true start predicates and actions on a new line. Default: false.
    columnLimit?: number;                       // Default: 100 chars.
    continuationIndentWidth?: number;           // For line continuation (only used if useTab is false). Default: same as indentWith.
    indentWidth?: number;                       // Default: 4 chars.
    keepEmptyLinesAtTheStartOfBlocks?: boolean; // Default: false.
    maxEmptyLinesToKeep?: number;               // Default: 1.
    reflowComments?: boolean;                   // Default: true.
    spaceBeforeAssignmentOperators?: boolean;   // Default: true
    tabWidth?: number;                          // Default: 4.
    useTab?: boolean;                           // Default: true.

    // Values not found in clang-format:

    // When set to "none" places the colon directly behind the rule name. Trailing alignment aligns colons of consecutive
    // single line rules (with at least one whitespace between rule name and colon). Hanging alignment moves the
    // colon to the next line (after the normal indentation, aligning it so with the alt pipe chars).
    // Default: none.
    alignColons?: "none" | "trailing" | "hanging";

    // When `allowShortRulesOnASingleLine` is true and `alignColon` is set to "hanging" this setting determines which gets
    // precedence. If true (the default) a rule is placed on a single line if it fits, ignoring the "hanging" setting.
    singleLineOverrulesHangingColon?: boolean;
    allowShortRulesOnASingleLine?: boolean; // Like allowShortBlocksOnASingleLine, but for entire rules. Default: true.

    // Place semicolon behind last code token or on an own line (with or w/o indentation). Default: ownLine (no indentation).
    // This setting has no effect for non-rule commands that end with a semicolon (e.g. "grammar Test;", "import Blah;" etc.).
    // Such commands are always placed on a single line.
    alignSemicolons?: "none" | "ownLine" | "hanging";
    breakBeforeParens?: boolean; // For blocks: if true puts opening parentheses on an own line. Default: false.

    // Place rule internals (return value, local variables, @init, @after) all on a single line, if true. Default: false.
    ruleInternalsOnSingleLine?: boolean;
    minEmptyLines?: number; // Between top level elements, how many empty lines must exist? Default: 0.

    // When true alignments are organized in groups of lines where they apply. These line groups are separated
    // by lines where a specific alignment type does not appear. Default: true.
    groupedAlignments?: boolean;
    alignFirstTokens?: boolean; // Align first tokens in rules after the colon. Default: false.
    alignLexerCommands?: boolean; // Align arrows from lexer commands. Default: false.
    alignActions?: boolean; // Align actions ({} blocks in rules) and predicates. Default: false.
    alignLabels?: boolean; // Align alt labels (# name). Default: true.

    // When true a single alignment for labels, actions, lexer commands and trailing comments is used instead of
    // individual alignments for each type. This avoids large whitespace runs if you have a mix of these types.
    // Setting alignTrailers disables the individual alignment settings of the mentioned types.
    alignTrailers?: boolean;
}

export type PredicateFunction = (predicate: string) => boolean;

export interface ContextDetails {
    type: GrammarType;
    unreferencedRules: string[];
    imports: string[];
}

export interface SelfDiagnostics {
    contextCount: number;
}

interface ContextEntry {
    context: SourceContext;
    refCount: number;
    dependencies: string[];
    grammar: string; // The grammar file name.
}

export class AntlrFacade {
    // Mapping file names to SourceContext instances.
    private sourceContexts: Map<string, ContextEntry> = new Map<string, ContextEntry>();

    public constructor(private importDir: string) {
    }

    /**
     * Info for unit tests.
     *
     * @returns An object with interesting details (currently only the number of existing contexts).
     */
    public getSelfDiagnostics(): SelfDiagnostics {
        return {
            contextCount: this.sourceContexts.keys.length,
        };
    }

    public getContext(fileName: string, source?: string | undefined): SourceContext {
        const contextEntry = this.sourceContexts.get(fileName);
        if (!contextEntry) {
            return this.loadGrammar(fileName, source);
        }

        return contextEntry.context;
    }

    /**
     * Call this to refresh the internal input stream as a preparation to a reparse call
     * or for code completion.
     * Does nothing if no grammar has been loaded for that file name.
     *
     * @param fileName The grammar file name.
     * @param source The grammar code.
     */
    public setText(fileName: string, source: string): void {
        const contextEntry = this.sourceContexts.get(fileName);
        if (contextEntry) {
            contextEntry.context.setText(source);
        }
    }

    /**
     * Triggers a parse run for the given file name. This grammar must have been loaded before.
     *
     * @param fileName The grammar file name.
     */
    public reparse(fileName: string): void {
        const contextEntry = this.sourceContexts.get(fileName);
        if (contextEntry) {
            this.parseGrammar(contextEntry);
        }
    }

    public loadGrammar(fileName: string, source?: string): SourceContext {
        let contextEntry = this.sourceContexts.get(fileName);
        if (!contextEntry) {
            if (!source) {
                try {
                    fs.statSync(fileName);
                    source = fs.readFileSync(fileName, "utf8");
                } catch (e) {
                    source = "";
                }
            }

            const context = new SourceContext(fileName);
            contextEntry = { context, refCount: 0, dependencies: [], grammar: fileName };
            this.sourceContexts.set(fileName, contextEntry);

            // Do an initial parse run and load all dependencies of this context
            // and pass their references to this context.
            context.setText(source);
            this.parseGrammar(contextEntry);
        }
        contextEntry.refCount++;

        return contextEntry.context;
    }

    public releaseGrammar(fileName: string): void {
        this.internalReleaseGrammar(fileName);
    }

    public symbolInfoAtPosition(fileName: string, column: number, row: number,
        limitToChildren = true): SymbolInfo | undefined {
        const context = this.getContext(fileName);

        return context.symbolAtPosition(column, row, limitToChildren);
    }

    public infoForSymbol(fileName: string, symbol: string): SymbolInfo | undefined {
        const context = this.getContext(fileName);

        return context.getSymbolInfo(symbol);
    }

    public enclosingSymbolAtPosition(fileName: string, column: number, row: number,
        ruleScope = false): SymbolInfo | undefined {
        const context = this.getContext(fileName);

        return context.enclosingSymbolAtPosition(column, row, ruleScope);
    }

    /**
     * Returns a list of top level symbols from a file (and optionally its dependencies).
     *
     * @param fileName The grammar file name.
     * @param fullList If true, includes symbols from all dependencies as well.
     *
     * @returns A list of symbol info entries.
     */
    public listTopLevelSymbols(fileName: string, fullList: boolean): SymbolInfo[] {
        const context = this.getContext(fileName);

        return context.listTopLevelSymbols(!fullList);
    }

    /**
     * Returns the vocabulary for the given file (if it contains lexer rules).
     *
     * @param fileName The grammar file name.
     *
     * @returns The vocabulary if found.
     */
    public getLexerVocabulary(fileName: string): Vocabulary | undefined {
        const context = this.getContext(fileName);

        return context.getVocabulary();
    }

    /**
     * Returns a list of rule names for the given file (if it contains parser rules).
     *
     * @param fileName The grammar file name.
     *
     * @returns The list of rule names.
     */
    public getRuleList(fileName: string): string[] | undefined {
        const context = this.getContext(fileName);

        return context.getRuleList();
    }

    /**
     * Returns a list of channel names for the given file (if it contains lexer rules).
     *
     * @param fileName The grammar file name.
     *
     * @returns The list of channel names.
     */
    public getChannels(fileName: string): string[] | undefined {
        const context = this.getContext(fileName);

        return context.getChannels();
    }

    /**
     * Returns a list of lexer modes for the given file (if it contains lexer rules).
     *
     * @param fileName The grammar file name.
     *
     * @returns The list of mode names.
     */
    public getModes(fileName: string): string[] | undefined {
        const context = this.getContext(fileName);

        return context.getModes();
    }

    /**
     * Returns a list of actions + predicates found in the given file.
     *
     * @param fileName The grammar file name.
     *
     * @returns The list of actions + predicates.
     */
    public listActions(fileName: string): SymbolInfo[] {
        const context = this.getContext(fileName);

        return context.listActions();
    }

    public getCodeCompletionCandidates(fileName: string, column: number, row: number): SymbolInfo[] {
        const context = this.getContext(fileName);

        return context.getCodeCompletionCandidates(column, row);
    }

    public getDiagnostics(fileName: string): DiagnosticEntry[] {
        const context = this.getContext(fileName);

        return context.getDiagnostics();
    }

    public ruleFromPosition(fileName: string, column: number, row: number): [string | undefined, number | undefined] {
        const context = this.getContext(fileName);

        return context.ruleFromPosition(column, row);
    }

    /**
     * Count how many times a symbol has been referenced. The given file must contain the definition of this symbol.
     *
     * @param fileName The grammar file name.
     * @param symbol The symbol for which to determine the reference count.
     *
     * @returns The reference count.
     */
    public countReferences(fileName: string, symbol: string): number {
        const context = this.getContext(fileName);

        return context.getReferenceCount(symbol);
    }

    /**
     * Determines source file and position of all occurrences of the given symbol. The search includes
     * also all referencing and referenced contexts.
     *
     * @param fileName The grammar file name.
     * @param symbolName The name of the symbol to check.
     *
     * @returns A list of symbol info entries, each describing one occurrence.
     */
    public getSymbolOccurrences(fileName: string, symbolName: string): SymbolInfo[] {
        const context = this.getContext(fileName);
        const result = context.symbolTable.getSymbolOccurrences(symbolName, false);

        // Sort result by kind. This way rule definitions appear before rule references and are re-parsed first.
        return result.sort((lhs: SymbolInfo, rhs: SymbolInfo) => lhs.kind - rhs.kind);
    }

    public getDependencies(fileName: string): string[] {
        const entry = this.sourceContexts.get(fileName);
        if (!entry) {
            return [];
        }
        const dependencies: Set<SourceContext> = new Set();
        this.pushDependencyFiles(entry, dependencies);

        const result: string[] = [];
        for (const dep of dependencies) {
            result.push(dep.fileName);
        }

        return result;
    }

    public getReferenceGraph(fileName: string): Map<string, ReferenceNode> {
        const context = this.getContext(fileName);

        return context.getReferenceGraph();
    }

    public getRRDScript(fileName: string, rule: string): string {
        const context = this.getContext(fileName);

        return context.getRRDScript(rule) || "";
    }

    public generate(fileName: string, options: GenerationOptions): Promise<string[]> {
        const context = this.getContext(fileName);
        const dependencies: Set<SourceContext> = new Set();
        this.pushDependencyFiles(this.sourceContexts.get(fileName)!, dependencies);

        return context.generate(dependencies, options);
    }

    public getATNGraph(fileName: string, rule: string): ATNGraphData | undefined {
        const context = this.getContext(fileName);

        return context.getATNGraph(rule);
    }

    public generateSentence(fileName: string, rule: string, options: SentenceGenerationOptions,
        callback: (sentence: string, index: number) => void): void {
        const context = this.getContext(fileName);

        const dependencies = new Set<SourceContext>();
        this.pushDependencyFiles(this.sourceContexts.get(fileName)!, dependencies);

        const basePath = path.dirname(fileName);

        for (const dependency of dependencies) {
            if (dependency.hasErrors) {
                callback("[Fix grammar errors first]", 0);

                return;
            }

            if (!dependency.isInterpreterDataLoaded) {
                dependency.setupInterpreters(path.join(basePath, ".antlr"));
            }
        }

        context.generateSentence(dependencies, rule, options, callback);
    }

    public lexTestInput(fileName: string, input: string, actionFile?: string): [string[], string] {
        const context = this.getContext(fileName);

        return context.lexTestInput(input, actionFile);
    }

    public parseTestInput(fileName: string, input: string, startRule: string, actionFile?: string): string[] {
        const context = this.getContext(fileName);

        return context.parseTestInput(input, startRule, actionFile);
    }

    public formatGrammar(fileName: string, options: FormattingOptions, start: number,
        stop: number): [string, number, number] {
        const context = this.getContext(fileName);

        return context.formatGrammar(options, start, stop);
    }

    public hasErrors(fileName: string): boolean {
        const context = this.getContext(fileName);

        return context.hasErrors;
    }

    public createDebugger(fileName: string, actionFile: string, dataDir: string): GrammarDebugger | undefined {
        const context = this.getContext(fileName);
        if (!context) {
            return;
        }

        const contexts: Set<SourceContext> = new Set();
        contexts.add(context);
        this.pushDependencyFiles(this.sourceContexts.get(fileName)!, contexts);

        for (const dependency of contexts) {
            if (dependency.hasErrors) {
                return;
            }

            if (!dependency.isInterpreterDataLoaded) {
                dependency.setupInterpreters(dataDir);
            }
        }

        return new GrammarDebugger([...contexts], actionFile);
    }

    public getContextDetails(fileName: string): ContextDetails {
        const context = this.getContext(fileName);

        return context.info;
    }

    private loadDependency(contextEntry: ContextEntry, depName: string): SourceContext | undefined {
        // The given import dir is used to locate the dependency (either relative to the base path or via an
        // absolute path).
        // If we cannot find the grammar file that way we try the base folder.
        const basePath = path.dirname(contextEntry.grammar);
        const fullPath = path.isAbsolute(this.importDir) ? this.importDir : path.join(basePath, this.importDir);
        try {
            const depPath = path.join(fullPath, depName + ".g4");
            fs.accessSync(depPath, fs.constants.R_OK);
            // Target path can be read. Now check the target file.
            contextEntry.dependencies.push(depPath);

            return this.loadGrammar(depPath);
        } catch (e) {
            // ignore
        }

        // File not found. Try other extension.
        try {
            const depPath = path.join(fullPath, depName + ".g");
            fs.accessSync(depPath, fs.constants.R_OK);
            // Target path can be read. Now check the target file.
            contextEntry.dependencies.push(depPath);

            return this.loadGrammar(depPath);
        } catch (e) {
            // ignore
        }

        // Couldn't find it in the import folder. Use the base then.
        try {
            const depPath = path.join(basePath, depName + ".g4");
            fs.statSync(depPath);
            contextEntry.dependencies.push(depPath);

            return this.loadGrammar(depPath);
        } catch (e) {
            // ignore
        }

        try {
            const depPath = path.join(basePath, depName + ".g");
            fs.statSync(depPath);
            contextEntry.dependencies.push(depPath);

            return this.loadGrammar(depPath);
        } catch (e) {
            // ignore
        }

        // Ignore the dependency if we cannot find the source file for it.
        return undefined;
    }

    private parseGrammar(contextEntry: ContextEntry) {
        const oldDependencies = contextEntry.dependencies;
        contextEntry.dependencies = [];
        const newDependencies = contextEntry.context.parse();

        for (const dep of newDependencies) {
            const depContext = this.loadDependency(contextEntry, dep);
            if (depContext) { contextEntry.context.addAsReferenceTo(depContext); }
        }

        // Release all old dependencies. This will only unload grammars which have
        // not been ref-counted by the above dependency loading (or which are not used by other
        // grammars).
        for (const dep of oldDependencies) { this.releaseGrammar(dep); }
    }

    private internalReleaseGrammar(fileName: string, referencing?: ContextEntry): void {
        const contextEntry = this.sourceContexts.get(fileName);
        if (contextEntry) {
            if (referencing) {
                // If a referencing context is given remove this one from the reference's dependencies list,
                // which in turn will remove the referencing context from the dependency's referencing list.
                referencing.context.removeDependency(contextEntry.context);
            }

            contextEntry.refCount--;
            if (contextEntry.refCount === 0) {
                this.sourceContexts.delete(fileName);

                // Release also all dependencies.
                for (const dep of contextEntry.dependencies) {
                    this.internalReleaseGrammar(dep, contextEntry);
                }
            }
        }
    }

    private pushDependencyFiles(entry: ContextEntry, contexts: Set<SourceContext>) {
        // Using a set for the context list here, to automatically exclude duplicates.
        for (const dep of entry.dependencies) {
            const depEntry = this.sourceContexts.get(dep);
            if (depEntry) {
                this.pushDependencyFiles(depEntry, contexts);
                contexts.add(depEntry.context);
            }
        }
    }


}
