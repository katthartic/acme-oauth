const express = require('express')
const axios = require('axios')
const app = express()
app.use(express.json())
const path = require('path')
const db = require('./db')
const { User, Login } = db.models
const jwt = require('jwt-simple')
const qs = require('qs')

const port = process.env.PORT || 3000
db.syncAndSeed().then(() =>
  app.listen(port, () => console.log(`listening on port ${port}`))
)

app.use('/dist', express.static(path.join(__dirname, 'dist')))

app.use((req, res, next) => {
  if (!req.headers.authorization) {
    return next()
  }
  User.findByToken(req.headers.authorization)
    .then((user) => {
      req.user = user
      next()
    })
    .catch(next)
})

app.post('/api/sessions', (req, res, next) => {
  User.findOne({
    where: {
      email: req.body.email,
      password: req.body.password,
    },
  })
    .then(async (user) => {
      if (!user) {
        throw { status: 401 }
      }
      await Login.create({ userId: user.id })
      return res.send({
        token: jwt.encode({ id: user.id }, process.env.SECRET),
      })
    })
    .catch((err) => next(err))
})

const CLIENT_ID = '571d19270bf3a1c7c390'
const CLIENT_SECRET = 'dfcd31d71410c89f3bd1c63f81d6740b7f2758c6'

app.get('/github', (req, res, next) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}`
  res.redirect(url)
})

app.get('/github/callback', (req, res, next) => {
  const url = 'https://github.com/login/oauth/access_token'

  const payload = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: req.query.code,
  }
  console.log(payload)
  axios
    .post(url, payload)
    .then((response) => {
      const { access_token } = qs.parse(response.data)
      const url = 'https://api.github.com/user'
      return axios.get(url, {
        headers: {
          Authorization: `token ${access_token}`,
        },
      })
    })
    .then((response) => {
      return User.generateToken(response.data)
    })
    .then((token) => {
      res.send(`
        <html>
            <script>
                window.localStorage.setItem('token', ${token})
                window.document.location = '/';
            </script>
        </html>
        `)
    })
    .catch(next)
})

app.get('/api/sessions', (req, res, next) => {
  if (req.user) {
    return res.send(req.user)
  }
  next({ status: 401 })
})

app.get('/api/logins', (req, res, next) => {
  Login.findAll({ where: { userId: req.user.id } })
    .then((logins) => res.send(logins))
    .catch(next)
})

app.delete('/api/sessions', (req, res, next) => {
  req.session.destroy()
  res.sendStatus(204)
})

app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).send(err.message)
})
