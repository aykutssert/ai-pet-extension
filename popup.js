/**
 * AI Pet Companion - Dynamic Popup Script
 * Fetches pet info from JSON and handles selection.
 */

const AVAILABLE_PETS = ['dude', 'goku', 'recep'];

document.addEventListener('DOMContentLoaded', async () => {
  const petList = document.getElementById('petList');
  const loading = document.getElementById('loading');

  // Load current pet from storage
  const { selectedPet = 'dude' } = await chrome.storage.local.get('selectedPet');

  // Fetch pet data and build UI
  for (const petId of AVAILABLE_PETS) {
    try {
      const response = await fetch(chrome.runtime.getURL(`assets/${petId}/pet.json`));
      const petData = await response.json();

      const card = document.createElement('div');
      card.className = `pet-card ${selectedPet === petId ? 'active' : ''}`;
      card.dataset.pet = petId;
      
      card.innerHTML = `
        <div class="pet-preview" style="background-image: url('assets/${petId}/spritesheet.webp');"></div>
        <div class="pet-info">
          <b>${petData.displayName}</b>
        </div>
      `;

      card.addEventListener('click', async () => {
        // Update UI
        document.querySelectorAll('.pet-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        // Save
        await chrome.storage.local.set({ selectedPet: petId });

        // Notify tabs
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'PET_CHANGED', pet: petId }).catch(() => {});
        });
      });

      petList.appendChild(card);
    } catch (err) {
      // console.error(`Failed to load pet: ${petId}`, err);
    }
  }

  loading.style.display = 'none';
});
