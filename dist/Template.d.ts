import { INode, TContent, IElement } from './Parser';
export interface ITemplateElement {
    name: string | null;
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
        [name: string]: (el: IElement) => TContent | null;
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
    _currentElement: ITemplateElement;
    _elements: Array<ITemplateElement>;
    _elementMap: {
        [elName: string]: ITemplateElement;
    };
    _renderer: IRenderer;
    _elementRendererMap: IElementRendererMap;
    constructor(beml: string, opts?: {
        parent?: Template;
        blockName?: string;
    });
    _handleNode(node: INode, parentElementName?: string): void;
    _renderElementClasses(elNames: Array<string | null>): string;
    extend(beml: string, opts?: {
        blockName?: string;
    }): Template;
    render(): any;
}
