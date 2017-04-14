import { INode as IBemlNode, TContent as TBemlContent, IElement as IBemlElement } from './Parser';
export interface INode {
    elementName: string | null;
    superCall: boolean;
    source: Array<string> | null;
    innerSource: Array<string>;
}
export interface IRenderer {
    (this: IElementRendererMap): string;
}
export interface IElementRenderer {
    (this: IElementRendererMap, $super?: IElementRendererMap): string;
}
export interface IElementRendererMap {
    [elName: string]: IElementRenderer;
}
export default class Template {
    static helpers: {
        [name: string]: (el: IBemlElement) => TBemlContent | null;
    };
    parent: Template | null;
    _elementClassesTemplate: Array<string>;
    _tagNameMap: {
        [elName: string]: string;
    };
    _attributeListMap: {
        [elName: string]: Object;
    };
    _attributeCountMap: {
        [elName: string]: number;
    };
    _currentNode: INode;
    _nodes: Array<INode>;
    _nodeMap: {
        [elName: string]: INode;
    };
    _renderer: IRenderer;
    _elementRendererMap: IElementRendererMap;
    constructor(beml: string, opts?: {
        parent?: Template;
        blockName?: string;
    });
    _handleNode(node: IBemlNode, parentElementName?: string): void;
    _renderElementClasses(elNames: Array<string | null>): string;
    extend(beml: string, opts?: {
        blockName?: string;
    }): Template;
    render(): any;
}
