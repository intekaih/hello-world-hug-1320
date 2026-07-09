/* movieCC - Admin JavaScript */

// getCsrfToken - admin.js load trước app.js nên cần định nghĩa local
function getCsrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') || '' : '';
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('show');
    }
}

window.openModal = openModal;
window.closeModal = closeModal;

document.querySelectorAll('.modal-overlay').forEach(function(modal) {
    document.body.appendChild(modal);
});

var btnCreate = document.getElementById('btnCreateUser');
if (btnCreate) {
    btnCreate.addEventListener('click', function() {
        openModal('createUserModal');
    });
}

setTimeout(() => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        // Ngăn click bên trong modal lan ra overlay
        overlay.querySelector('.modal')?.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // Chỉ đóng khi mousedown trực tiếp trên overlay (vùng tối bên ngoài)
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('show');
            }
        });
    });
}, 100);

// Đóng modal khi bấm Escape (chỉ khi không focus vào input)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    }
});

// ============ API Helpers ============
async function apiCall(url, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': getCsrfToken()
            }
        };
        if (data) options.body = JSON.stringify(data);

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.error || 'Có lỗi xảy ra');
        }

        return result;
    } catch (err) {
        throw err;
    }
}

function showAlert(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else {
        alert(message);
    }
}

// ============ Tạo User ============
const createForm = document.getElementById('createUserForm');
if (createForm) {
    const durationType = document.getElementById('createDurationType');
    const customDays = document.getElementById('createCustomDays');
    if (durationType && customDays) {
        durationType.addEventListener('change', () => {
            if (durationType.value === 'custom') {
                customDays.style.display = 'block';
                customDays.required = true;
            } else {
                customDays.style.display = 'none';
                customDays.required = false;
            }
        });
    }

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(createForm);
        const data = Object.fromEntries(formData);

        // Auto-generate password: username + @123
        data.password = data.username + '@123';
        
        // Handle duration -> expires_at
        let days = 0;
        if (durationType && durationType.value === 'custom') {
            days = parseInt(customDays.value, 10) || 0;
        } else if (durationType && durationType.value !== 'forever') {
            days = parseInt(durationType.value, 10) || 0;
        }
        
        if (days > 0) {
            const expires = new Date();
            expires.setDate(expires.getDate() + days);
            data.expires_at = expires.toISOString();
        } else {
            data.expires_at = null; // forever
        }

        try {
            const result = await apiCall('/admin/api/users', 'POST', data);
            
            // Generate copy text
            const copyText = `Kính gửi Quý khách,

Cảm ơn Quý khách đã sử dụng dịch vụ của MovieCC. Dưới đây là thông tin đăng nhập của Quý khách:

🌐 Truy cập tại: https://moviecc.app/login
👤 Tài khoản: ${data.username}
🔑 Mật khẩu: ${data.password}

Chúc Quý khách có những trải nghiệm xem phim tuyệt vời.
Trong quá trình sử dụng, nếu cần hỗ trợ, xin vui lòng liên hệ với Admin.

Trân trọng!`;
            
            // Show custom success modal
            document.getElementById('createdUsername').textContent = data.username;
            document.getElementById('createdCopyText').value = copyText;
            closeModal('createUserModal');
            openModal('accountCreatedModal');
            
            createForm.reset();
            if (durationType) durationType.value = '30';
            if (customDays) { customDays.style.display = 'none'; customDays.required = false; }
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// Copy account info logic
const copyCreatedInfoBtn = document.getElementById('copyCreatedInfo');
if (copyCreatedInfoBtn) {
    copyCreatedInfoBtn.addEventListener('click', function () {
        const field = document.getElementById('createdCopyText');
        field.select();
        navigator.clipboard.writeText(field.value).then(function () {
            copyCreatedInfoBtn.style.color = 'var(--primary,#F4ABB4)';
            setTimeout(function () { copyCreatedInfoBtn.style.color = ''; }, 1500);
        }).catch(function () {
            document.execCommand('copy');
        });
    });
}

// ============ Sửa User ============
function editUser(id, e) {
    var el = e && e.target ? e.target : (e instanceof Element ? e : null);
    var btn = el ? el.closest('[data-action="editUser"]') : document.querySelector('[data-action="editUser"][data-id="' + id + '"]');
    if (!btn) return;

    // Điền thông tin vào form chỉnh sửa
    document.getElementById('editUserId').value = id;
    document.getElementById('editUsername').value = btn.dataset.username;
    document.getElementById('editDisplayName').value = btn.dataset.display;
    document.getElementById('editRole').value = btn.dataset.role;

    const planEl = document.getElementById('editPlan');
    if (planEl) planEl.value = btn.dataset.plan;

    const sourceEl = document.getElementById('editSource');
    if (sourceEl) sourceEl.value = btn.dataset.source;

    const expiresEl = document.getElementById('editExpires');
    if (expiresEl) expiresEl.value = btn.dataset.expires;

    // Reset password field
    const passwordField = document.querySelector('#editUserForm input[name="password"]');
    if (passwordField) passwordField.value = '';

    // Mở modal
    openModal('editUserModal');
}

window.editUser = editUser;

// Xử lý submit form chỉnh sửa
const editForm = document.getElementById('editUserForm');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editUserId').value;
        const formData = new FormData(editForm);
        const data = Object.fromEntries(formData);

        // Xóa các trường không cần gửi
        delete data.userId;
        delete data.username;

        // Nếu password trống thì không gửi
        if (!data.password) delete data.password;

        try {
            const result = await apiCall(`/admin/api/users/${id}`, 'PUT', data);
            showAlert(result.message, 'success');
            closeModal('editUserModal');
            location.reload();
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// ============ Toggle Status ============
async function toggleUser(id) {
    if (!confirm('Xác nhận thay đổi trạng thái tài khoản?')) return;

    try {
        const result = await apiCall(`/admin/api/users/${id}/toggle-status`, 'PATCH');
        showAlert(result.message, 'success');
        location.reload();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

window.toggleUser = toggleUser;

// ============ Xóa User ============
async function deleteUser(id) {
    if (!confirm('Xác nhận xóa tài khoản này? Hành động này không thể hoàn tác.')) return;

    try {
        const result = await apiCall(`/admin/api/users/${id}`, 'DELETE');
        showAlert(result.message, 'success');
        location.reload();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

window.deleteUser = deleteUser;
