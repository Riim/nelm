let Template = require('../dist/Template').default;

test('simple template', () => {
	expect(new Template(`
		#block1
		span { 'text' }
	`).render()).toBe('<span>text</span>');
});

test('public element', () => {
	expect(new Template(`
		#block1
		span/el1 { 'text' }
	`).render()).toBe('<span class="block1__el1">text</span>');
});

test('private element', () => {
	expect(new Template(`
		#block1
		span/_el1 { 'text' }
	`).render()).toBe('<span>text</span>');
});

test('overriding public element', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
		br
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 { 'other text' }
	`).render()).toBe('<div class="block1-x__el1 block1__el1">other text</div><br>');
});

test('overriding private element', () => {
	let t1 = new Template(`
		#block1
		span/_el1 { 'text' }
		br
	`);

	expect(t1.extend(`
		#block1-x
		div/_el1 { 'other text' }
	`).render()).toBe('<div>other text</div><br>');
});

test('content super', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 { span { super! } }
	`).render()).toBe('<div class="block1-x__el1 block1__el1"><span>text</span></div>');
});

test('content super.el-name', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 { span/el2 { super.el1! } }
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
		div/el1 (super!)
	`).render()).toBe('<div attr1="value1" attr2="value2" class="block1-x__el1 block1__el1"></div>');
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
	`).render()).toBe('<div attr3="value3" attr4="value4" class="block1-x__el1 block1__el1 _mod1"></div><div attr1="value1" attr2="value2" class="block1-x__el2 block1__el2 _mod2"></div>');
});
