let NodeType = require('nelm-parser').NodeType;
let Template = require('../dist/Template').default;

test('simple template', () => {
	expect(new Template(`
		#block1
		span { 'text' }
	`).render()).toBe('<span>text</span>');
});

test('element', () => {
	expect(new Template(`
		#block1
		span/el1 { 'text' }
	`).render()).toBe('<span class="block1__el1">text</span>');
});

test('multiple names', () => {
	expect(new Template(`
		#block1
		span/name1, name2
	`).render()).toBe('<span class="block1__name1 block1__name2"></span>');
});

test('multiple names 2', () => {
	expect(new Template(`
		#block1
		span/, name1, name2
	`).render()).toBe('<span class="block1__name1 block1__name2"></span>');
});

test('overriding element', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
		br
	`);

	expect(t1.extend(`
		#block1-x
		/el1 { 'other text' }
	`).render()).toBe('<span class="block1-x__el1 block1__el1">other text</span><br>');
});

test('content super', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 {
			span { super! }
		}
	`).render()).toBe('<div class="block1-x__el1 block1__el1"><span>text</span></div>');
});

test('content super 2', () => {
	let t1 = new Template(`
		#block1
		span/el1
		span/el2
	`);

	expect(t1.extend(`
		#block1-x
		div/el2 { super! }
	`).render()).toBe('<span class="block1-x__el1 block1__el1"></span><div class="block1-x__el2 block1__el2"></div>');
});

test('content super.el-name', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 {
			span/el2 { super.el1! }
		}
	`).render()).toBe(
		'<div class="block1-x__el1 block1__el1"><span class="block1-x__el2 block1__el2">text</span></div>'
	);
});

test('attributes super', () => {
	let t1 = new Template(`
		#block1
		span/el1 (attr1=value1, attr2=value2)
	`);

	expect(t1.extend(`
		#block1-x
		/el1 (super!)
	`).render()).toBe('<span class="block1-x__el1 block1__el1" attr1="value1" attr2="value2"></span>');
});

test('attributes super 2', () => {
	let t1 = new Template(`
		#block1
		span/span1 (class=_mod1)
	`);

	expect(t1.extend(`
		#block1-x
		/span1 (super!)
	`).render()).toBe('<span class="block1-x__span1 block1__span1 _mod1"></span>');
});

test('attributes super.el-name!', () => {
	let t1 = new Template(`
		#block1
		span/el1 (attr1=value1, attr2=value2)
		span/el2 (attr3=value3, attr4=value4)
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 (super.el2!, class=_mod1)
		div/el2 (super.el1!, class=_mod2)
	`).render()).toBe(
		'<div attr3="value3" attr4="value4" class="block1-x__el1 block1__el1 _mod1"></div><div attr1="value1" attr2="value2" class="block1-x__el2 block1__el2 _mod2"></div>'
	);
});

test('attributes super._el-name!', () => {
	let t1 = new Template(`
		#block1
		span/el1 (attr1=value1, attr2=value2)
		span/el2 (attr3=value3, attr4=value4)
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 (super.el2!, class=_mod1)
		div/el2 (super.el1!, class=_mod2)
	`).render()).toBe(
		'<div attr3="value3" attr4="value4" class="block1-x__el1 block1__el1 _mod1"></div><div attr1="value1" attr2="value2" class="block1-x__el2 block1__el2 _mod2"></div>'
	);
});

test('comment in attributes', () => {
	expect(new Template(`
		#block1
		span (/* comment */)
		span (attr1/* comment */=1)
		span (/* comment */attr1)
		span (attr1/* comment */, attr2)
		span (
			attr1, // comment
			/* comment */
			attr2=1
			// comment
		)
	`).render()).toBe(
		'<span></span><span attr1="1"></span><span attr1=""></span><span attr1="" attr2=""></span><span attr1="" attr2="1"></span>'
	);
});

test('helper', () => {
	Template.helpers.test = el => {
		return [
			{ nodeType: NodeType.TEXT, value: '1' },
			{ nodeType: NodeType.TEXT, value: '2' },
			{ nodeType: NodeType.TEXT, value: '3' }
		];
	};

	expect(new Template(`
		#block1
		span { @test }
	`).render()).toBe('<span>123</span>');
});

test('helper 2', () => {
	Template.helpers.test = el => {
		return [
			{ nodeType: NodeType.TEXT, value: '[' },
			...el.content,
			{ nodeType: NodeType.TEXT, value: ']' }
		];
	};

	expect(new Template(`
		#block1
		span {
			@test { div }
		}
	`).render()).toBe('<span>[<div></div>]</span>');
});

test('helper super', () => {
	Template.helpers.test = el => {
		return [{
			nodeType: NodeType.ELEMENT,
			isHelper: false,
			tagName: 'span',
			names: el.names && el.names[0] ? ['$' + el.names[0], ...el.names] : el.names,
			attributes: el.attributes,
			content: null
		}];
	};

	let t1 = new Template(`
		#block1
		@test/test (attr1=value1)
	`);

	expect(t1.extend(`
		#block1-x
		@/test (super!, attr2=value2)
	`).render()).toBe(
		'<span class="block1-x__$test block1__$test block1-x__test block1__test" attr1="value1" attr2="value2"></span>'
	);
});

test('helper content super', () => {
	let t1 = new Template(`
		#block1
		@section/inner {
			span
		}
	`);

	expect(t1.extend(`
		#block1-x
		@/inner {
			div { super! }
		}
	`).render()).toBe('<div><span></span></div>');
});

test('escape sequences', () => {
	expect(new Template(`
		'_\\t_\\x20_\\u0020_'
	`).render()).toBe('_\t_\x20_\u0020_');
});
