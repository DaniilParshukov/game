const titles = {
  account: { main: 'Накопительный счёт в банке', sub: 'Разберём инструмент за 60 секунд' },
  ofz: { main: 'ОФЗ - облигации федерального займа', sub: 'Государственный долг как инвестиционный инструмент' },
  corp: { main: 'Облигации корпораций', sub: 'Долг компаний: доход выше, риск тоже' },
  vdo: { main: 'ВДО: высокодоходные облигации', sub: 'Больше потенциального дохода — больше риска' },
  stocks: { main: 'Акции корпораций', sub: 'Ты становишься совладельцем компании' },
  currency: { main: 'Иностранная валюта', sub: 'Доход или убыток от изменения курса' },
  pif: { main: 'ПИФ — паевой инвестиционный фонд', sub: 'Коллективные инвестиции' },
  gold: { main: 'Золото как инвестиционный товар', sub: 'Актив, который часто рассматривают на долгий срок' }
};

const assets = ['account', 'ofz', 'corp', 'vdo', 'stocks', 'currency', 'pif', 'gold'];
let currentIndex = 0;

const contents = document.querySelectorAll('.asset-content');
const dots = document.querySelectorAll('.pagination .dot');
const counter = document.getElementById('pageCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const mainTitle = document.getElementById('mainTitle');
const subTitle = document.getElementById('subTitle');

const hints = {
  account: document.getElementById('hint-account'),
  ofz: document.getElementById('hint-ofz'),
  corp: document.getElementById('hint-corp'),
  vdo: document.getElementById('hint-vdo'),
  stocks: document.getElementById('hint-stocks'),
  currency: document.getElementById('hint-currency'),
  pif: document.getElementById('hint-pif'),
  gold: document.getElementById('hint-gold')
};

const arrows = {
  account: document.querySelector('.arrow-example--account'),
  ofz: document.querySelector('.arrow-example--ofz'),
  corp: document.querySelector('.arrow-example--corp'),
  vdo: document.querySelector('.arrow-example--vdo'),
  stocks: document.querySelector('.arrow-example--stocks'),
  currency: document.querySelector('.arrow-example--currency'),
  pif: document.querySelector('.arrow-example--pif'),
  gold: document.querySelector('.arrow-example--gold')
};

const circles = {
  account: document.querySelector('.question-circle--account'),
  ofz: document.querySelector('.question-circle--ofz'),
  corp: document.querySelector('.question-circle--corp'),
  vdo: document.querySelector('.question-circle--vdo'),
  stocks: document.querySelector('.question-circle--stocks'),
  currency: document.querySelector('.question-circle--currency'),
  pif: document.querySelector('.question-circle--pif'),
  gold: document.querySelector('.question-circle--gold')
};

const exampleOverlay = document.getElementById('exampleOverlay');

function updateUI(index) {
  contents.forEach((el) => el.classList.remove('active'));
  contents[index].classList.add('active');

  const asset = assets[index];
  mainTitle.textContent = titles[asset].main;
  subTitle.textContent = titles[asset].sub;

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  counter.textContent = `${index + 1} / ${assets.length}`;

  Object.keys(hints).forEach((key) => {
    const show = key === asset;
    if (hints[key]) hints[key].classList.toggle('visible', show);
    if (arrows[key]) arrows[key].classList.toggle('visible', show);
    if (circles[key]) circles[key].classList.toggle('visible', show);
  });
}

function goTo(index) {
  if (index < 0) index = assets.length - 1;
  if (index >= assets.length) index = 0;
  currentIndex = index;
  updateUI(currentIndex);
}

prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

dots.forEach((dot, i) => {
  dot.addEventListener('click', () => goTo(i));
});

document.querySelectorAll('.question-circle').forEach((circle) => {
  circle.addEventListener('click', () => {
    exampleOverlay.classList.toggle('visible');
  });
});

document.getElementById('closeExample').addEventListener('click', () => {
  exampleOverlay.classList.remove('visible');
});

exampleOverlay.addEventListener('click', (event) => {
  if (event.target === exampleOverlay) {
    exampleOverlay.classList.remove('visible');
  }
});

updateUI(0);
