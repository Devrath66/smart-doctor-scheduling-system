const token = localStorage.getItem('clinicToken');
const form = document.querySelector('#availabilityForm');
const list = document.querySelector('#availabilityList');
const message = document.querySelector('#availabilityMessage');
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('The schedule service is temporarily unavailable. Please refresh the page.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The schedule service could not complete that request.');
  return data;
}

function formatTime(value) {
  return value ? value.slice(0, 5) : '';
}

function render(rows) {
  if (!rows.length) {
    list.innerHTML = '<div class="portal-empty">No availability windows yet. Add your first working period.</div>';
    return;
  }
  list.innerHTML = rows.map((row) => `
    <article class="availability-row ${row.is_active ? '' : 'availability-inactive'}">
      <div class="availability-day"><strong>${dayNames[row.day_of_week]}</strong><span>${row.is_active ? 'Open for booking' : 'Paused'}</span></div>
      <strong class="availability-hours">${formatTime(row.start_time)} - ${formatTime(row.end_time)}</strong>
      <span class="portal-pill">${row.slot_duration_min} min slots</span>
      <button type="button" class="text-button" data-id="${row.availability_id}" data-active="${row.is_active ? 'false' : 'true'}">${row.is_active ? 'Pause' : 'Activate'}</button>
    </article>
  `).join('');
}

async function loadAvailability() {
  if (!token) {
    list.innerHTML = '<div class="portal-empty">Please sign in with the doctor login first.</div>';
    return;
  }
  try {
    const response = await fetch('/api/availability/doctor', { headers: { Authorization: `Bearer ${token}` } });
    const rows = await readJson(response);
    render(rows);
  } catch (error) {
    const errorMessage = error.message === 'Failed to fetch' ? 'The clinic service is offline. Start the server and refresh the page.' : error.message;
    list.innerHTML = `<div class="portal-empty">${errorMessage}</div>`;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dayOfWeek: Number(document.querySelector('#dayOfWeek').value), startTime: document.querySelector('#startTime').value, endTime: document.querySelector('#endTime').value, slotDurationMin: Number(document.querySelector('#slotDurationMin').value) })
    });
    await readJson(response);
    message.textContent = 'Availability added.';
    await loadAvailability();
  } catch (error) {
    message.textContent = error.message === 'AVAILABILITY_OVERLAP' ? 'That window overlaps an existing one.' : error.message === 'Failed to fetch' ? 'The clinic service is offline. Start the server and try again.' : error.message;
  }
});

list.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  const response = await fetch(`/api/availability/${button.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive: button.dataset.active === 'true' }) });
  if (response.ok) loadAvailability();
});

document.querySelector('#headerLogout').addEventListener('click', () => {
  localStorage.removeItem('clinicToken');
  localStorage.removeItem('clinicRole');
  localStorage.removeItem('clinicUserName');
  window.location.href = '/doctor-login.html';
});

loadAvailability();
