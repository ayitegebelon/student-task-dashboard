// Session Guard - Redirect to login if not authenticated
(function checkAuthSession() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.id) {
    window.location.href = 'login.html';
  }
})();
