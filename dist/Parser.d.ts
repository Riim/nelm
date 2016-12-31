export declare enum BemlNodeType {
    BLOCK = 1,
    ELEMENT = 2,
    TEXT = 3,
    COMMENT = 4,
}
export interface IBemlNode {
    nodeType: BemlNodeType;
    at: number;
    raw: string;
}
export interface IBemlBlockDeclaration {
    at: number;
    raw: string;
    blockName: string;
}
export declare type TBemlContent = Array<IBemlNode>;
export interface IBemlBlock extends IBemlNode {
    nodeType: BemlNodeType.BLOCK;
    declaration: IBemlBlockDeclaration;
    name: string;
    content: TBemlContent;
}
export interface IBemlElementAttribute {
    name: string;
    value: string | true;
}
export declare type TBemlElementAttributeList = Array<IBemlElementAttribute>;
export interface IBemlElementAttributes {
    at: number;
    raw: string;
    list: TBemlElementAttributeList;
}
export interface IBemlElement extends IBemlNode {
    nodeType: BemlNodeType.ELEMENT;
    name: string | null;
    attributes: IBemlElementAttributes | null;
    content: TBemlContent | null;
}
export interface IBemlTextNode extends IBemlNode {
    nodeType: BemlNodeType.TEXT;
    value: string;
}
export interface IBemlComment extends IBemlNode {
    nodeType: BemlNodeType.COMMENT;
    value: string;
    multiline: boolean;
}
export default class Parser {
    beml: string;
    at: number;
    chr: string;
    constructor(beml: string);
    parse(): IBemlBlock;
    _readBlockDeclaration(): IBemlBlockDeclaration;
    _readContent(brackets: boolean): TBemlContent;
    _readElement(): IBemlElement;
    _readAttributes(): IBemlElementAttributes;
    _readTextNode(): IBemlTextNode;
    _readString(): string;
    _readComment(): IBemlComment;
    _readName(): string | null;
    _skipWhitespaces(): string;
    _next(current?: string): string;
}
