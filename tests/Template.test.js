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

test('super', () => {
	let t1 = new Template(`
		#block1
		span/el1 { 'text' }
		br
	`);

	expect(t1.extend(`
		#block1-x
		div/el1 { span { super! } }
	`).render()).toBe('<div class="block1-x__el1 block1__el1"><span>text</span></div><br>');
});
