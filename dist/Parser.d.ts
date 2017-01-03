export declare enum NodeType {
    BLOCK = 1,
    ELEMENT = 2,
    TEXT = 3,
    COMMENT = 4,
    SUPER_CALL = 5,
}
export interface INode {
    nodeType: NodeType;
    at: number;
    raw: string;
}
export interface IBlockDeclaration {
    blockName: string;
    at: number;
    raw: string;
}
export declare type TContent = Array<INode>;
export interface IBlock extends INode {
    nodeType: NodeType.BLOCK;
    declaration: IBlockDeclaration;
    name: string;
    content: TContent;
}
export interface IElementAttribute {
    name: string;
    value: string;
}
export declare type TElementAttributeList = Array<IElementAttribute>;
export interface IElementAttributes {
    list: TElementAttributeList;
    at: number;
    raw: string;
}
export interface IElement extends INode {
    nodeType: NodeType.ELEMENT;
    tagName: string;
    name: string | null;
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
export interface ISuperCall extends INode {
    nodeType: NodeType.SUPER_CALL;
}
export default class Parser {
    beml: string;
    at: number;
    chr: string;
    constructor(beml: string);
    parse(): IBlock;
    _readBlockDeclaration(): IBlockDeclaration;
    _readContent(brackets: boolean): TContent;
    _readElement(): IElement;
    _readAttributes(): IElementAttributes;
    _readTextNode(): ITextNode;
    _readString(): {
        value: string;
    };
    _readComment(): IComment;
    _readName(reNameOrNothing: RegExp): string | null;
    _skipWhitespaces(): string;
    _next(current?: string): string;
}
