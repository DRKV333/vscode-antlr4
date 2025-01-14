/*
 * This file is released under the MIT license.
 * Copyright (c) 2018, 2023, Mike Lischke
 *
 * See LICENSE file for more info.
 */

import { TreeDataProvider, TreeItem, EventEmitter, TextDocument, ProviderResult, Event } from "vscode";
import { AntlrFacade } from "../backend/facade";

export class AntlrTreeDataProvider<T extends TreeItem> implements TreeDataProvider<T> {
    protected currentFile: string | undefined;

    private changeEvent = new EventEmitter<void>();

    public constructor(protected backend: AntlrFacade) { }

    public get onDidChangeTreeData(): Event<void> {
        return this.changeEvent.event;
    }

    public refresh(document: TextDocument | undefined): void {
        if (document && document.languageId === "antlr" && document.uri.scheme === "file") {
            this.currentFile = document.fileName;
        } else {
            this.currentFile = undefined;
        }
        this.changeEvent.fire();
    }

    public getTreeItem(element: T): TreeItem {
        return element;
    }

    public getChildren(_element?: T): ProviderResult<T[]> {
        return undefined;
    }
}
