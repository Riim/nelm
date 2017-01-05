import { INode as IBemlNode } from './Parser';
export interface INode {
    elementName: string | null;
    source: Array<string>;
    hasSuperCall: boolean;
}
export interface IRenderer {
    (this: IElementRendererMap): string;
}
export interface IElementRenderer {
    (this: IElementRendererMap, $super?: IElementRenderer): string;
}
export interface IElementRendererMap {
    [name: string]: IElementRenderer;
}
export default class Template {
    static compile(beml: string): Template;
    parent: Template | null;
    _classesTemplate: Array<string>;
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
    _handleNode(node: IBemlNode): void;
    extend(beml: string, opts?: {
        blockName?: string;
    }): Template;
    render(): any;
}
