/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Autodesk Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////
const { FoldersApi } = require('forge-apis');
const { 
    createFolderBody, 
    deleteFolder,
    getHubs,
    getProjects,
    getFolders,
    getFolderContents,
    getVersions
 } = require('./common/datamanagementImp');
const { OAuth } = require('./common/oauth');
const express = require('express');
let router = express.Router();



///////////////////////////////////////////////////////////////////////
/// Middleware for obtaining a token for each request.
///////////////////////////////////////////////////////////////////////
router.use(async (req, res, next) => {
    const oauth = new OAuth(req.session);
    const credentials = await oauth.getInternalToken();
    if( credentials ){
        req.oauth_client = oauth.getClient()
        req.oauth_token = credentials;     
        next();       
    }
});



router.get('/datamanagement/v1', async (req, res) => {
    // The id querystring parameter contains what was selected on the UI tree, make sure it's valid
    const href = decodeURIComponent(req.query.id);
    if (href === '') {
        res.status(500).end();
        return;
    }

    if (href === '#') {
        // If href is '#', it's the root tree node
        getHubs(req.oauth_client, req.oauth_token, res);
    } else {
        // Otherwise let's break it by '/'
        const params = href.split('/');
        const resourceName = params[params.length - 2];
        const resourceId = params[params.length - 1];
        switch (resourceName) {
            case 'hubs':
                getProjects(resourceId, req.oauth_client, req.oauth_token, res);
                break;
            case 'projects':
                // For a project, first we need the top/root folder
                const hubId = params[params.length - 3];
                getFolders(hubId, resourceId/*project_id*/, req.oauth_client, req.oauth_token, res);
                break;
            case 'folders':
                {
                    const projectId = params[params.length - 3];
                    getFolderContents(projectId, resourceId/*folder_id*/, req.oauth_client, req.oauth_token, res);
                    break;
                }
            case 'items':
                {
                    const projectId = params[params.length - 3];
                    getVersions(projectId, resourceId/*item_id*/, req.oauth_client, req.oauth_token, res);
                    break;
                }
        }
    }
});

// delete a folder
router.delete('/datamanagement/v1/folders/:folder_url', async (req, res) => {
    const href = req.params.folder_url;
    if (href === '' || href === null) {
        res.status(400).end('input id is null');
        return;
    }

    const params = href.split('/');
    if (params.length < 3) {
        res.status(400).end('input id is not correct');
        return;
    }
    const projectId = params[params.length - 3];
    const folderId = params[params.length - 1];

    try {
        await deleteFolder(projectId, folderId, req.oauth_token.access_token);
        res.status(204).end();
    } catch (err) {
        res.status(500).end(err);
    }
})


// create a subfolder
router.post('/datamanagement/v1/folders', async (req, res) =>{
    const href = req.body.id;
    const folderName = req.body.name;
    if (href === '' || folderName === '') {
        res.status(500).end();
        return;
    }

    if (href === '#') {
        res.status(400).end('Not supported item');
        return;
    } 

    const params = href.split('/');
    if( params.length < 3){
        res.status(400).end('selected item id has problem');
        return;
    }

    const resourceName = params[params.length - 2];
    if (resourceName !== 'folders') {
        res.status(400).end('not supported item');
        return;
    }

    const projectId = params[params.length - 3];
    const folderId  = params[params.length - 1];

    // create a new folder
    const folders = new FoldersApi();
    const folderBody = createFolderBody(folderName, folderId);
      try{
        const newFolder = await folders.postFolder(projectId, folderBody, req.oauth_client, req.oauth_token);
        console.log(newFolder);
        if(newFolder === null || newFolder.statusCode !== 201){
            console.log('failed to create a folder.');
            res.status(500).end('failed to create a folder.');
            return;
        }
        let folderInfo = {
            id: newFolder.body.links.self.href,
            type: newFolder.body.data.type
        }
        res.status(201).end(JSON.stringify(folderInfo));
      }catch(err){
        console.log('failed to create a folder.');
        res.status(500).end('failed to create a folder.');
      }
})


module.exports = router;
