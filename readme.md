# Overview #

Web client database API for Indexeddb, Web SQL and
localStorage storage mechanisms supporting version migration, advanced query and transaction.

# Setup #

Run apache or a static server on its www directory, downloads the following three repos

    svn checkout http://closure-library.googlecode.com/svn/trunk/
    closure-library
    git clone git@bitbucket.org:ytkyaw/ydn-db.git
    git clone https://bitbucket.org/ytkyaw/ydn-base.git

that should create three directories for closure-library, ydn-base and ydn-db

# Testing #

You should able to run /ydn-db/test/all-test.html and pass all tests.

And then, setup [JsTestDriver]  (http://code.google.com/p/js-test-driver/)
And test it

    java -jar JsTestDriver.jar --tests all

# Using #

Nice tutorial on [YDN-DB Documentation] (http://dev.yathit.com)


# License #
Licensed under the Apache License, Version 2.0