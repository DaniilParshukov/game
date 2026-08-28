(function () {
  const storageKey = 'copilka-player-name';

  function getPlayerName() {
    try {
      return localStorage.getItem(storageKey) || 'Игрок';
    } catch (error) {
      return 'Игрок';
    }
  }

  function setPlayerName(name) {
    try {
      localStorage.setItem(storageKey, name);
    } catch (error) {
      console.warn('Не удалось сохранить имя игрока', error);
    }
  }

  function syncProfileNames() {
    const playerName = getPlayerName();
    document.querySelectorAll('.nav-profile, .profile-btn').forEach((el) => {
      el.textContent = playerName;
      if (!el.getAttribute('href') && !el.dataset.go) {
        el.setAttribute('href', 'registration.html');
      }
    });
  }

  function bindNavigation() {
    document.querySelectorAll('[data-go]').forEach((element) => {
      element.addEventListener('click', (event) => {
        const target = element.getAttribute('data-go');
        if (!target) return;
        event.preventDefault();
        window.location.href = target;
      });
    });

    document.querySelectorAll('[data-back]').forEach((element) => {
      element.addEventListener('click', (event) => {
        const target = element.getAttribute('data-back');
        if (!target) return;
        event.preventDefault();
        window.location.href = target;
      });
    });
  }

  function bindRegistration() {
    const input = document.querySelector('.input-field');
    const button = document.querySelector('.btn-continue');
    if (!input || !button) return;

    input.value = getPlayerName();

    const submit = () => {
      const value = input.value.trim() || 'Игрок';
      setPlayerName(value);
      window.location.href = 'portfolio.html';
    };

    button.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
  }

  function bindPortfolioActions() {
    const finishMonthBtn = document.querySelector('.btn-finish-month');
    if (finishMonthBtn) {
      finishMonthBtn.addEventListener('click', () => {
        window.location.href = 'results.html';
      });
    }

    document.querySelectorAll('.action-item[data-go]').forEach((item) => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-go');
        if (target) {
          window.location.href = target;
        }
      });
    });

    const profileLink = document.querySelector('.nav-profile, .profile-btn');
    if (profileLink) {
      profileLink.setAttribute('href', 'registration.html');
    }
  }

  function bindResultsActions() {
    const replayBtn = document.querySelector('#playAgainBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        window.location.href = 'registration.html';
      });
    }

    const portfolioBtn = document.querySelector('#backToPortfolioBtn');
    if (portfolioBtn) {
      portfolioBtn.addEventListener('click', () => {
        window.location.href = 'portfolio.html';
      });
    }
  }

  function bindIndexButton() {
    const startButton = document.querySelector('.btn-start');
    if (startButton) {
      startButton.addEventListener('click', () => {
        window.location.href = 'registration.html';
      });
    }
  }

  function bindTradePage() {
    const navBack = document.querySelector('.nav-portfolio');
    if (navBack) {
      navBack.setAttribute('href', 'portfolio.html');
    }

    const profileLink = document.querySelector('.nav-profile');
    if (profileLink) {
      profileLink.setAttribute('href', 'registration.html');
    }
  }

  function bindTeachingPage() {
    const backLink = document.querySelector('.back-btn');
    if (backLink) {
      backLink.setAttribute('href', 'portfolio.html');
    }
  }

  syncProfileNames();
  bindNavigation();
  bindIndexButton();
  bindRegistration();
  bindPortfolioActions();
  bindResultsActions();
  bindTradePage();
  bindTeachingPage();
})();
