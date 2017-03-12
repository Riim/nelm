# beml

Это новогодний эксперимент, который оказался довольно удачным.
Основное назначение -- возможность гибкого переопределения элементов вёрстки. Вот смотри, как переопределяется __логика__: тебе понадобилось что-то добавить к поведению компонента, ты наследуешь от него, находишь какой-то метод и добавляешь к нему что-то ещё:
```js
myMethod() {
	// сюда
	super.myMethod();
	// или сюда
}
```
Чувак который писал исходный компонент вынес часть логики в myMethod не для того чтобы тебе было удобно в него что-то добавить, а просто ему, чисто для себя, удобно распределять логику по методам. Он о тебе вообще не парился, но тем не менее автоматически решил твою проблему: в 99% случаев место куда тебе нужно добавить что-то своё окажется в начале или в конце какого-то метода и вместо дублирования кода ты просто напишешь `super.myMethod`.
Примерно тоже самое с переопределением стилей: в 99% случаев на нужном элементе уже есть какой-то класс.

## Проблема

А вот с вёрсткой всё не так, давай на примере реакта: есть метод `render` в котором дофигища вёрстки, и вот тебе понадобилось добавить ещё одну обёртку для какого-то элемента посреди этой вёрстки. Можно переопределить `render`, скопипастить туда содержимое родителя и сделать нужное изменение. И это самый отстойный вариант, во-первых, много дублирования кода, во-вторых, теперь прийдётся постоянно следить за родительским компонентом и при изменениях вёрстки в нём делать тоже самое у себя. Вариант второй: присылаем пулреквест в котором нужный элемент вынесен в отдельный метод. Уже лучше, но всё же это полумера: почему теперь можно переопределить этот элемент, но нельзя соседний? Почему каждый раз нужно делать пулреквест и ждать пока автор компонента примет его? Автор тоже может понимать проблему и захочет дать максимально гибкий для переопределения компонент. И это уже третий вариант: автор разносит создание каждого элемента по методам. Минус здесь очевиден: сложно понять, что за вёрстка получается в итоге, вёрстку, в отличии от логики, удобнее видеть всю целиком, а не разложенную по методам. Попробуем совсем иначе, шаблонизатор [nunjucks](https://mozilla.github.io/nunjucks/) позволяет создавать переопределяемые блоки:
```html
<div>
	{% block mySpan %}
		<span>123</span>
	{% endblock %}
</div>
```
Переопределяем:
```html
{% block mySpan %}
	{# можно добавить что-то здесь #}
	{{ super() }}
	{# или здесь #}
{% endblock %}
```
Теперь уже лучше -- вся вёрстка в одном месте. Но остался выбор, либо каждый раз делать пулреквест добавляющий блок в нужном месте, либо захламлять всю верстку кучей блоков везде где может понадобиться что-то переопределить.

## Решение

Разрабатывая [opal-components](https://github.com/Riim/opal-components) с использованием шаблонизатора подобного nunjucks я заметил следующую особенность: во всех случаях (видимо те самые 99%) переопределяется элемент имеющий BEM-класс. BEM-классы добавляются не только для добавления стилей к элементам, но и для обращения к элементам из js-кода -- [Rionite](https://github.com/Riim/Rionite) позволяет делать это только по имени элемента (без указания имени блока):
```js
this.$('element-name') // сокращение для this.element.querySelector('.block-name__element-name')
```
Так почему бы автоматически не генерировать переопределяемые блоки по именам элементов? Beml делает именно это:
<p>
    <img src="https://3.downloader.disk.yandex.ru/preview/2e72e898571ad9eda618a30a34fe2315296eb17db8bf3f550ac49c8a2e3c4644/inf/ObPNusslySg1DkKXVbAng5E2G6lidPu5J6KLHZoHoEtXFot5RCgOlPkhq7jW6VVK0Z3axkADyMiypKVJQ5y_2A%3D%3D?uid=0&filename=2017-03-12_18-56-00.png&disposition=inline&hash=&limit=0&content_type=image%2Fpng&tknv=v2&size=XXL&crop=0" width="312">
</p>

`#block1` -- имя BEM-блока. Может определяться в начале файла, или передаваться при создании шаблона (Rionite передаёт `elementIs` компонента):
```js
import { Template } from '@riim/beml';

let template = new Template(`
	div/element1 {
		div/element2 (attr1=123) {
			'123'
		}
	}
`, { blockName: 'block1' })

console.log(template.render());
```

`element1` и `element2` -- имена BEM-элементов -- будут соеденены с именем блока через разделитель.
В результате сгенерируется следующий html (только без пробелов):
```html
<div class="block1__element1">
	<div class="block1__element2" attr1="123">
		123
	</div>
</div>
```
Теперь можно что-нибудь переопределить:

<p>
    <img src="https://1.downloader.disk.yandex.ru/disk/9c81246c940f6e0b5305ad89cdab474593fa3b2a52cf830402aaacb66cca17fd/58c5c91b/ObPNusslySg1DkKXVbAng66Fa-dYP4s-JqqH2dWI_9OwlNweb1pO4OuxA7pT14M01A6QPTgrLLndWJVuLKFXaw%3D%3D?uid=0&filename=2017-03-12_21-17-43.png&disposition=inline&hash=&limit=0&content_type=image%2Fpng&fsize=51888&hid=2e1cdfd5b5e233d63d9bc6e3ea5fe46a&media_type=image&tknv=v2&etag=4519bf70eeb310c13e3941cb91992216" width="776">
</p>

Использование в js:
```js
import block1Template from './block1.beml';

let block1XTemplate = block1Template.extend(`
	#block1-x

	div/element1 {
		span { 'span' } // подставляем новый элемент перед ...
		super! // ... оригинальным содержимым
	}

	// имя тега меняем на span
	span/element2 (super!/* оригинальные атрибуты */, attr2='321'/* новый атрибут */) {
		super!
	}
`)

console.log(block1XTemplate.render());
```

Результат:
```html
<div class="block1__element1 block1-x__element1">
	<span>span</span>
	<span class="block1__element2 block1-x__element2" attr1="123" attr2="321">
		123
	</span>
</div>
```

## Синтаксис

<p>
    <img src="https://4.downloader.disk.yandex.ru/preview/859c2d9bbcf14c10a0c4dc323f69ddcb8bba9ec6859ae67038bbdf5c0e76b373/inf/ObPNusslySg1DkKXVbAng-6mYHP1itCHPCSofzTutc00RT7JzPS3ubJjMNrMm12gO5db3ZmsFfB3opLDZjrQBw%3D%3D?uid=0&filename=2017-03-12_21-30-27.png&disposition=inline&hash=&limit=0&content_type=image%2Fpng&tknv=v2&size=XXL&crop=0" width="904">
</p>

## Подсветка синтаксиса

[vscode-beml](https://marketplace.visualstudio.com/items?itemName=riim.vscode-beml)
