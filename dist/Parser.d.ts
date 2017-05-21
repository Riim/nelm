export declare enum NodeType {
    BLOCK = 1,
    ELEMENT = 2,
    TEXT = 3,
    COMMENT = 4,
    SUPER_CALL = 5,
}
export interface INode {
    nodeType: NodeType;
}
export declare type TContent = Array<INode>;
export interface IBlock extends INode {
    nodeType: NodeType.BLOCK;
    name: string | null;
    content: TContent;
}
export interface ISuperCall extends INode {
    nodeType: NodeType.SUPER_CALL;
    elementName: string | null;
}
export interface IElementAttribute {
    name: string;
    value: string;
}
export declare type TElementAttributeList = Array<IElementAttribute>;
export interface IElementAttributes {
    superCall: ISuperCall | null;
    list: TElementAttributeList;
}
export interface IElement extends INode {
    nodeType: NodeType.ELEMENT;
    tagName: string | null;
    isHelper: boolean;
    names: Array<string | null> | null;
    attributes: IElementAttributes | null;
    content: TContent | null;
}
export interface ITextNode extends INode {
    nodeType: NodeType.TEXT;
    value: string;
}
export interface IComment extends INode {
    nodeType: NodeType.COMMENT;
    value: string;
    multiline: boolean;
}
export default class Parser {
    nelm: string;
    at: number;
    chr: string;
    constructor(nelm: string);
    parse(): IBlock;
    _readBlockName(): string;
    _readContent(brackets: boolean): TContent;
    _readElement(): IElement;
    _readAttributes(): IElementAttributes;
    _skipWhitespacesAndComments(): string;
    _readSuperCall(): ISuperCall | null;
    _readTextNode(): ITextNode;
    _readString(): {
        value: string;
        multiline: boolean;
    };
    _readComment(): IComment;
    _readElementNames(): Array<string | null> | null;
    _readName(reNameOrNothing: RegExp): string | null;
    _skipWhitespaces(): string;
    _next(current?: string): string;
}
