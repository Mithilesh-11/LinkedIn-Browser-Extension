export function initEditModal({ onSave }) {
  let currentEditCandidate = null;

  const editModal = document.createElement('div');
  editModal.className = 'edit-modal hidden';
  editModal.innerHTML = `
    <div class="edit-modal-backdrop"></div>
    <div class="edit-modal-card">
      <div class="edit-modal-header">
        <h3>Edit profile</h3>
        <button type="button" class="edit-modal-close" aria-label="Close">close</button>
      </div>
      <form id="candidateEditForm" class="edit-form">
        <div class="edit-field">
          <label for="editName">Name</label>
          <input id="editName" name="name" type="text">
        </div>   
        <div class="edit-field">
          <label for="editHeadline">Headline</label>
          <input id="editHeadline" name="headline" type="text">
        </div>
        <div class="edit-field">
          <label for="editCompany">Company</label>
          <input id="editCompany" name="company" type="text">
        </div>
        <div class="edit-field">
          <label for="editLocation">Location</label>
          <input id="editLocation" name="location" type="text">
        </div>
        <div class="edit-field">
          <label for="editUrl">Profile URL</label>
          <input id="editUrl" name="url" type="text">
        </div>
        <div class="edit-field">
          <label for="editFollowers">Followers</label>
          <input id="editFollowers" name="followers" type="number" min="0">
        </div>
        <div class="edit-field">
          <label for="editProfileImage">Profile Image URL</label>
          <input id="editProfileImage" name="profileImage" type="text">
        </div>
        <div class="edit-field">
          <label for="editAbout">About</label>
          <textarea id="editAbout" name="about"></textarea>
        </div>
        <div class="edit-modal-actions">
          <button type="button" class="edit-cancel-btn">Cancel</button>
          <button type="submit" class="edit-save-btn">Save changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(editModal);

  const editForm = editModal.querySelector('#candidateEditForm');
  const editModalTitle = editModal.querySelector('.edit-modal-header h3');

  const closeEditModal = () => {
    editModal.classList.add('hidden');
    currentEditCandidate = null;
    editForm.reset();
  };

  editModal.querySelector('.edit-modal-backdrop').addEventListener('click', closeEditModal);
  editModal.querySelector('.edit-modal-close').addEventListener('click', closeEditModal);
  editModal.querySelector('.edit-cancel-btn').addEventListener('click', closeEditModal);

  function getDisplayValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      if (value.every(item => typeof item !== 'object' || item === null)) {
        return value.join(', ');
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentEditCandidate) return;

    const formData = new FormData(editForm);
    const updatedCandidate = {
      ...currentEditCandidate,
      url: formData.get('url')?.toString().trim() || currentEditCandidate.url || null,
      name: formData.get('name')?.toString().trim() || null,
      headline: formData.get('headline')?.toString().trim() || null,
      company: formData.get('company')?.toString().trim() || null,
      location: formData.get('location')?.toString().trim() || null,
      about: formData.get('about')?.toString().trim() || null,
      followers: formData.get('followers')?.toString().trim() ? Number(formData.get('followers')) : 0,
      profileImage: formData.get('profileImage')?.toString().trim() || null,
    };

    const success = await onSave(updatedCandidate);
    if (success) {
      closeEditModal();
    }
  });

  return {
    openEditModal(candidate) {
      currentEditCandidate = candidate || null;
      if (!currentEditCandidate) return;

      editModalTitle.textContent = `Edit ${currentEditCandidate.name || 'profile'}`;
      editForm.elements.name.value = getDisplayValue(currentEditCandidate.name);
      editForm.elements.headline.value = getDisplayValue(currentEditCandidate.headline);
      editForm.elements.company.value = getDisplayValue(currentEditCandidate.company);
      editForm.elements.location.value = getDisplayValue(currentEditCandidate.location);
      editForm.elements.url.value = getDisplayValue(currentEditCandidate.url);
      editForm.elements.followers.value = getDisplayValue(currentEditCandidate.followers);
      editForm.elements.profileImage.value = getDisplayValue(currentEditCandidate.profileImage);
      editForm.elements.about.value = getDisplayValue(currentEditCandidate.about);
      editModal.classList.remove('hidden');
    },
  };
}