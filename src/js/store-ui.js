(() => {
  'use strict';

  function init(options) {
    const {
      storeDialog,
      gameMenuDialog,
      storeCatalog,
      storeFeedback,
      storeTabs,
      flappyStoreTabs,
      flappyStoreSubtabs,
      storeCentBalance,
      characterOptions,
      shopButton,
      gameShopButton,
      openDialog,
      closeGameMenu,
      getCharacter,
      selectCharacterFromStore,
      updateCharacterOptions,
      updateEconomyUI,
      announce
    } = options;

    let activeStoreTab = 'avatars';
    let activeFlappyStoreTab = 'birds';

    function openStore(tab = 'avatars', flappyTab = activeFlappyStoreTab) {
      if (gameMenuDialog.open) closeGameMenu();
      activeStoreTab = tab;
      activeFlappyStoreTab = flappyTab;
      storeFeedback.textContent = '';
      renderStore();
      openDialog(storeDialog);
    }

    function makeStoreSection(title, detail, items) {
      const section = document.createElement('section');
      section.className = 'store-section';
      const heading = document.createElement('div');
      heading.className = 'store-section-title';
      const titleNode = document.createElement('h3');
      titleNode.textContent = title;
      const detailNode = document.createElement('span');
      detailNode.textContent = detail;
      heading.append(titleNode, detailNode);
      const grid = document.createElement('div');
      grid.className = 'store-grid';
      items.forEach((item) => grid.appendChild(item));
      section.append(heading, grid);
      return section;
    }

    function makeStoreCard({ name, image, owned, selected, price, locked, previewNode, previewClass, actionLabel, onAction }) {
      const card = document.createElement('article');
      card.className = `store-item${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`;
      const preview = document.createElement('span');
      preview.className = previewClass || (locked ? 'store-item-preview' : image ? 'store-item-preview' : 'store-bird-preview');
      if (locked) {
        preview.textContent = '✦';
        preview.setAttribute('aria-hidden', 'true');
      } else if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = '';
        img.loading = 'lazy';
        preview.appendChild(img);
      } else if (previewNode) {
        preview.appendChild(previewNode.cloneNode(true));
      }
      const title = document.createElement('span');
      title.className = 'store-item-name';
      title.textContent = name;
      const status = document.createElement('span');
      status.className = 'store-item-status';
      status.textContent = locked ? 'Diseño pendiente' : selected ? 'En uso' : owned ? 'Disponible' : `${price} Cent`;
      const action = document.createElement('button');
      action.className = 'store-item-action';
      action.type = 'button';
      action.textContent = locked ? 'En beta' : selected ? 'Equipado' : owned ? (actionLabel || 'Elegir') : `¢ ${price}`;
      action.disabled = Boolean(locked || selected);
      if (!action.disabled) action.addEventListener('click', onAction);
      card.append(preview, title, status, action);
      return card;
    }

    function renderStore() {
      const current = window.CenEconomy.getProfile();
      if (!current) {
        storeCatalog.replaceChildren();
        return;
      }
      storeTabs.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.storeTab === activeStoreTab)));
      flappyStoreTabs.hidden = activeStoreTab !== 'flappy';
      flappyStoreSubtabs.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.storeSubtab === activeFlappyStoreTab)));
      storeCentBalance.textContent = String(Math.max(0, Number(current.cents) || 0));
      storeCatalog.replaceChildren();

      if (activeStoreTab === 'avatars') {
        const catalog = window.CenEconomy.getAvatarCatalog();
        const owned = new Set(current.ownedAvatars || []);
        const free = catalog.filter((item) => item.price === 0);
        const paid = catalog.filter((item) => item.price > 0);
        const collection = paid.filter((item) => item.price === 40);
        const special = paid.filter((item) => item.price === 60);
        const freeCards = free.map((item) => makeStoreCard({
          name: item.name,
          image: item.image,
          owned: owned.has(item.id),
          selected: current.avatarId === item.id,
          price: 0,
          onAction: () => equipAvatar(item.id, item.name)
        }));
        const paidCards = (items) => items.map((item) => makeStoreCard({
          name: item.name,
          image: item.image,
          owned: owned.has(item.id),
          selected: current.avatarId === item.id,
          price: item.price,
          actionLabel: 'Elegir',
          onAction: () => owned.has(item.id) ? equipAvatar(item.id, item.name) : purchaseAvatar(item)
        }));
        storeCatalog.append(
          makeStoreSection('Avatares gratis', '5 para empezar', freeCards),
          makeStoreSection('Colección', `${collection.length} avatares · 40 Cent cada uno`, paidCards(collection)),
          makeStoreSection('Selección especial', `${special.length} avatares · 60 Cent cada uno`, paidCards(special))
        );
      } else if (activeStoreTab === 'flappy' && activeFlappyStoreTab === 'birds') {
        const freeBirds = window.CenEconomy.getFreeBirds();
        const betaBirds = window.CenEconomy.getBetaBirds();
        const birdCards = freeBirds.map((bird) => {
          const source = characterOptions.find((button) => button.dataset.character === bird.id);
          const preview = source && source.querySelector('.character-avatar');
          return makeStoreCard({
            name: bird.name,
            previewNode: preview,
            owned: true,
            selected: current.characterId === bird.id || getCharacter() === bird.id,
            onAction: () => equipBird(bird.id, bird.name)
          });
        });
        const futureCards = betaBirds.map((bird) => makeStoreCard({ name: bird.name, locked: true }));
        const betaNotice = document.createElement('div');
        betaNotice.className = 'store-beta-banner';
        const betaIcon = document.createElement('span');
        betaIcon.className = 'store-beta-icon';
        betaIcon.setAttribute('aria-hidden', 'true');
        betaIcon.textContent = '✦';
        const betaCopy = document.createElement('span');
        const betaTitle = document.createElement('strong');
        betaTitle.textContent = 'Tienda de pájaros en beta.';
        betaCopy.append(betaTitle, document.createTextNode(' Los próximos diseños se agregarán cuando estén listos.'));
        betaNotice.append(betaIcon, betaCopy);
        storeCatalog.append(
          makeStoreSection('Pájaros incluidos', '5 disponibles', birdCards),
          makeStoreSection('Próximos pájaros', '5 espacios reservados', futureCards),
          betaNotice
        );
      } else {
        const catalog = window.CenEconomy.getBackgroundCatalog();
        const owned = new Set(current.ownedBackgrounds || ['costa', 'aurora']);
        const makeBackgroundCard = (item) => {
          const preview = document.createElement('span');
          preview.className = 'store-background-art';
          preview.dataset.scene = item.scene;
          preview.setAttribute('aria-hidden', 'true');
          return makeStoreCard({
            name: item.name,
            owned: owned.has(item.id),
            selected: current.backgroundId === item.id,
            price: item.price,
            previewClass: 'store-background-preview',
            previewNode: preview,
            actionLabel: 'Elegir',
            onAction: () => owned.has(item.id) ? equipBackground(item) : purchaseBackground(item)
          });
        };
        storeCatalog.append(
          makeStoreSection('Fondos gratis', '2 para empezar', catalog.filter((item) => item.free).map(makeBackgroundCard)),
          makeStoreSection('Nuevos paisajes', 'se compran con Cent', catalog.filter((item) => !item.free).map(makeBackgroundCard))
        );
      }
    }

    async function equipAvatar(id, name) {
      try {
        await window.CenEconomy.chooseAvatar(id);
        storeFeedback.textContent = `${name} ahora es tu avatar.`;
        updateEconomyUI();
      } catch (error) {
        storeFeedback.textContent = error.message;
      }
    }

    async function purchaseAvatar(item) {
      try {
        await window.CenEconomy.buyAvatar(item.id);
        await window.CenEconomy.chooseAvatar(item.id);
        storeFeedback.textContent = `${item.name} listo. Se descontaron ${item.price} Cent.`;
        updateEconomyUI();
        announce(`Compraste el avatar ${item.name}.`);
      } catch (error) {
        storeFeedback.textContent = error.message;
      }
    }

    async function equipBird(id, name) {
      try {
        selectCharacterFromStore(id);
        await window.CenEconomy.chooseBird(id);
        updateCharacterOptions();
        storeFeedback.textContent = `${name} seleccionado.`;
        announce(`Personaje ${name} seleccionado.`);
        renderStore();
      } catch (error) {
        storeFeedback.textContent = error.message;
      }
    }

    async function equipBackground(item) {
      try {
        await window.CenEconomy.chooseBackground(item.id);
        storeFeedback.textContent = `${item.name} equipado.`;
        updateEconomyUI();
        announce(`Fondo ${item.name} equipado.`);
      } catch (error) {
        storeFeedback.textContent = error.message;
      }
    }

    async function purchaseBackground(item) {
      try {
        await window.CenEconomy.buyBackground(item.id);
        await window.CenEconomy.chooseBackground(item.id);
        storeFeedback.textContent = `${item.name} desbloqueado y equipado.`;
        updateEconomyUI();
        announce(`Compraste el fondo ${item.name}.`);
      } catch (error) {
        storeFeedback.textContent = error.message;
      }
    }

    shopButton.addEventListener('click', () => openStore('avatars'));
    gameShopButton.addEventListener('click', () => openStore('flappy', 'backgrounds'));
    storeTabs.forEach((button) => button.addEventListener('click', () => {
      activeStoreTab = button.dataset.storeTab;
      storeFeedback.textContent = '';
      renderStore();
    }));
    flappyStoreSubtabs.forEach((button) => button.addEventListener('click', () => {
      activeFlappyStoreTab = button.dataset.storeSubtab;
      storeFeedback.textContent = '';
      renderStore();
    }));
    return Object.freeze({ open: openStore, render: renderStore });
  }

  window.CenStoreUI = Object.freeze({ init });
})();
