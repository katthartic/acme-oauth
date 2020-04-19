const Sequelize = require('sequelize')
const { UUID, UUIDV4, STRING } = Sequelize
const jwt = require('jwt-simple')
const axios = require('axios')

const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/my_db'
)

const User = conn.define('user', {
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
  },
  github: {
    type: Sequelize.STRING,
  },
})

const Login = conn.define('login', {
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
  },
})

Login.belongsTo(User)

User.fromGithub = async function (code) {
  const { GITHUB_ID, GITHUB_SECRET } = process.env

  const payload = {
    client_id: GITHUB_ID,
    client_secret: GITHUB_SECRET,
    code,
  }
  const response = (
    await axios.post('https://github.com/login/oauth/access_token', payload, {
      headers: { accept: 'application/json' },
    })
  ).data

  const gitUser = (
    await axios.get('https://api.github.com/user', {
      headers: {
        authorization: `token ${response.access_token}`,
      },
    })
  ).data
  let user = await User.findOne({ where: { github: gitUser.login } })
  if (!user) {
    user = await User.create({ github: gitUser.login })
  }
  await Login.create({ userId: user.id })

  return jwt.encode({ id: user.id }, process.env.SECRET)
}

User.findByToken = async function (token) {
  try {
    const id = jwt.decode(token, process.env.SECRET).id
    const user = await this.findByPk(id)
    if (!user) {
      const err = new Error('not authorized')
      err.status = 401
      throw err
    }
    return user
  } catch (ex) {
    const err = new Error('not authorized')
    err.status = 401
    throw err
  }
}

const syncAndSeed = async () => {
  await conn.sync({ force: true })
}

module.exports = {
  models: {
    User,
    Login,
  },
  syncAndSeed,
}
