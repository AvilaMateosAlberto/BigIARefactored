
function authorizePermission(permissionName) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];

    if (!permissions.includes(permissionName)) {
      return res.status(403).json({ error: 'Permiso denegado' });
    }

    next();
  };
}

module.exports = authorizePermission;
