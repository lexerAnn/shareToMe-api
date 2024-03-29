const express = require('express')
const {verifyUser} = require("../utils/authUtil");
const {checkSchema, validationResult} = require("express-validator");
const {checkLink,  linkIdSchema} = require("../schemas/validation");
const router = express.Router();
const { DateTime } = require('luxon');
const { JSDOM } = require('jsdom');
const {db} = require("../db/connections");
const rp = require('request-promise');
const {ApiResponse} = require("../utils/ApiResonse");
const puppeteer = require('puppeteer');



const link = {
    link: checkLink
}

const linkId = {
    linkId: link,
}

router.get('/links', verifyUser, (req, res, next) => {
    const accountId = res.locals.accountId

    db.any("SELECT * FROM notes WHERE account_id = $1", accountId)
        .then(data => {
            const response = new ApiResponse(
                "success",
                "Fetch successfully",
                data,
                ""
            )
            res.status(200).json(
                response
            )
        })
        .catch(error => {
            const response = new ApiResponse(
                "error",
                "An error occurred",
                "",
                ""
            )
            console.log(error)
            res.status(501).json( response )
        })

})

router.post('/delete-link/:link_id', verifyUser, checkSchema(linkIdSchema), (req, res, next) => {
    const accountId = res.locals.accountId;
    const linkId = req.params.link_id;
    const errors = validationResult(req);

    if (!errors.isEmpty()){
        res.status(400).json({  message: errors.array()[0]['msg'] });
    } else {
        db.oneOrNone('SELECT 1 FROM notes WHERE id = $1 AND account_id = $2', [linkId, accountId])
            .then(data => {
                if (!data){
                    return res.status(404).json({ message: 'Link not found' });
                }
                return db.none('DELETE FROM notes WHERE id = $1 AND account_id = $2', [linkId, accountId])
            })
            .then( _ => {
                const response = new ApiResponse(
                    "success",
                    "Link Deleted Successfully",
                    `${linkId}`,
                    ""
                )
                res.status(200).json(
                    response
                )
            })
            .catch(error => {
                const response = new ApiResponse(
                    "error",
                    "An error occurred",
                    "",
                    ""
                )
                console.log(error)
                res.status(501).json( response )
            });
    }
});

router.post('/add-link', verifyUser, checkSchema(link),(req, res, next)=> {
    const accountId = res.locals.accountId; // Access accountId from res.locals

    const link = req.body['link']
    console.log(link)
    const errors = validationResult(req);

    if (!errors.isEmpty()){
        res.status(400).json({  message: errors.array()[0]['msg'] });
    } else  {
        fetchURLTitle(link).then(title => {
            const currentTime = DateTime.now().toFormat('HH:mm:ss');
            const currentDate = DateTime.local().toFormat('LLLL dd');


            const notesData = [title, link, currentDate, currentTime, accountId]
            db.none('INSERT INTO notes(title, link, date, time, account_id ) VALUES ($1, $2,$3,$4,$5)', notesData)
                .then(_ => {
                    const data = {
                        title: title,
                        link: link,
                        date: currentDate,
                        time: currentTime
                    }

                    const response = new ApiResponse(
                        "success",
                        "Link Added Successfully",
                         data,
                        ""
                    )

                    res.status(200).json(
                        response
                    )
                })
                .catch(error => {
                    const response = new ApiResponse(
                        "error",
                        "An error occurred",
                        "",
                        ""
                    )
                    console.log(error)
                    res.status(501).json( response )
                });
        })
    }
})

async function fetchURLTitle(url) {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            // `headless: true` (default) enables old Headless;
            // `headless: 'new'` enables new Headless;
            // `headless: false` enables “headful” mode.
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        await browser.close();
        return title;
    } catch (error) {
        console.error('Error fetching URL title', error);
    }
}
module.exports = router
