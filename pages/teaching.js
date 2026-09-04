(() => {
    const assets = [
        'account', 'ofz', 'corp', 'vdo',
        'stocks', 'currency', 'pif', 'gold'
    ];
    let currentIndex = 0;

    const titles = [
        'Накопительный счёт в банке',
        'ОФЗ — облигации федерального займа',
        'Корпоративные облигации',
        'ВДО — высокодоходные облигации',
        'Акции',
        'Иностранная валюта',
        'ПИФ — паевые инвестиционные фонды',
        'Золото'
    ];
    const subtitles = [
        'Разберём инструмент за 60 секунд',
        'Ты даёшь государству деньги в долг',
        'Компания занимает деньги у инвесторов',
        'Высокий купон не бывает бесплатным',
        'Часть компании в твоем портфеле',
        'Иностранные деньги и инструменты',
        'Много инвесторов — один фонд',
        'Золото — инвестиционный товар'
    ];

    const exampleTitles = [
        'Как считается доход за день',
        'Доход по ОФЗ за полгода + влияние ставки ЦБ',
        'Доход по облигации Компании А',
        'Доход по облигации Компании В',
        'Финансовый результат по акции Компании С',
        'Результат по дирхаму и евро',
        'Пример для ПИФ (скоро)',
        'Пример для Золота (скоро)'
    ];

    const exampleDescs = [
        'Например, если на начало дня на счете было 10000 рублей, потом на него с кошелька была переведена зарплата 10000 рублей, и в этот же день списаны 17000 рублей на покупку облигаций, то минимальный остаток в этот день на счете – 3000 рублей. За этот день процентный доход будет рассчитан: <code>(3000×1×10)/(365×100) = 0,82 рубля.</code>',
        'Время владения ОФЗ номиналом 1000 рублей — полгода (182 дня). Был выплачен купон 7% годовых, бумага выросла с 830 до 850 рублей. Общий доход: <code>(850–830)+(1000×182×7)/(365×100) = 20 + 34,90 = 54,90 ₽</code>.<br><br><strong>Как зависит цена от ставки ЦБ?</strong> После покупки ОФЗ по 900 ₽ рост ключевой ставки может снизить цену до 850 ₽ — потеря 50 ₽ с каждой бумаги. В реальных расчётах учтите налоги и комиссии.',
        'Облигация Компании А номиналом 1000 ₽, купон 12% годовых выплачивается ежемесячно. Владение 8 месяцев (≈9 выплат), цена упала с 930 до 920 ₽. Доход: <code>(920–930)+[(1000×31×12)/(365×100)]×9 = –10 + 91,73 = 81,73 ₽</code>. Налоги и комиссии не учтены.',
        'Облигация Компании В номинал 1000 ₽, купон 25% годовых выплачивается раз в квартал. Владение 3 месяца (91 день), цена выросла с 960 до 975 ₽. Доход: <code>(975–960)+(1000×91×25)/(365×100) = 15 + 62,33 = 77,33 ₽</code>. Налоги и комиссии не учтены.',
        'Акция Компании С номиналом 5000 ₽ куплена за 8200 ₽ 1 декабря. В январе выплачены дивиденды 20% от номинала = 1000 ₽. 1 мая из-за санкций цена упала на 50% от цены покупки: 8200 × 0,5 = 4100 ₽. Продажа: <code>1000 (дивиденды) – 4100 (убыток) = –3100 ₽</code>. Налог на дивиденды и комиссии не учтены (убыток налогом не облагается).',
        '31 января куплено 1000 дирхам по курсу 20,7921 ₽ и 1000 евро по курсу 89,5400 ₽. Продажа: дирхам 30 июня по 21,4225 ₽, евро 31 мая по 82,9705 ₽.<br><br>Дирхам: <code>(21,4225–20,7921)×1000 = +630,40 ₽</code><br>Евро: <code>(82,9705–89,5400)×1000 = –6569,50 ₽</code><br><strong>Итого: –5939,10 ₽</strong>',
        'Пример для ПИФ пока в разработке.',
        'Пример для Золота пока в разработке.'
    ];

    const contents = document.querySelectorAll('.asset-content');
    const dots = document.querySelectorAll('.dot');
    const counter = document.getElementById('pageCounter');
    const mainTitle = document.getElementById('mainTitle');
    const subTitle = document.getElementById('subTitle');
    const overlay = document.getElementById('exampleOverlay');
    const closeBtn = document.getElementById('closeExample');
    const questionCircle = document.getElementById('questionCircle');
    const contentCard = document.getElementById('contentCard');
    const exampleTitle = document.getElementById('exampleTitle');
    const exampleDesc = document.getElementById('exampleDesc');

    let isTransitioning = false;
    let resizeTimeout;

    function updateView(index) {
        if (isTransitioning) return;
            isTransitioning = true;

        contents.forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });

        const activeContent = contents[index];
        activeContent.style.display = 'flex';

        requestAnimationFrame(() => {
            activeContent.classList.add('active');

            dots.forEach(d => d.classList.remove('active'));
            dots[index].classList.add('active');
            counter.textContent = `${index + 1} / ${assets.length}`;
            mainTitle.textContent = titles[index];
            subTitle.textContent = subtitles[index];

            exampleTitle.textContent = exampleTitles[index];
            exampleDesc.innerHTML = exampleDescs[index];

            isTransitioning = false;
        });

        closeOverlay();
    }

    function goTo(index) {
        if (index < 0) index = assets.length - 1;
        if (index >= assets.length) index = 0;
        currentIndex = index;
        updateView(currentIndex);
    }

    function openOverlay() {
        overlay.classList.add('visible');
        contentCard.classList.add('blurred');
    }

    function closeOverlay() {
        overlay.classList.remove('visible');
        contentCard.classList.remove('blurred');
    }

    document.getElementById('prevBtn').addEventListener('click', () => goTo(currentIndex - 1));
    document.getElementById('nextBtn').addEventListener('click', () => goTo(currentIndex + 1));

    dots.forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
    });

    questionCircle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (overlay.classList.contains('visible')) {
        closeOverlay();
    } else {
        openOverlay();
    }
    });

    closeBtn.addEventListener('click', closeOverlay);

    overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
        closeOverlay();
    }
    });

    document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        closeOverlay();
    }
    });

    // Инициализация
    const firstContent = contents[0];
    firstContent.style.display = 'flex';
    requestAnimationFrame(() => {
    firstContent.classList.add('active');
    });

    // Ресайз с debounce
    window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Просто обновляем отображение без изменения индекса
        const active = contents[currentIndex];
        if (active) {
        contents.forEach(el => el.style.display = 'none');
        active.style.display = 'flex';
        requestAnimationFrame(() => {
            active.classList.add('active');
        });
        }
    }, 200);
    });
})();
  